import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

const router = express.Router();

// Get all services
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [services] = await pool.query(
      `
      SELECT 
        s.*,
        sc.name AS category_name
      FROM services s
      LEFT JOIN service_categories sc ON s.category_id = sc.id
      WHERE s.is_active = TRUE
      ORDER BY s.name
      `
    );
    res.json(services);
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get service by ID with history
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [services] = await pool.query(
      `
      SELECT 
        s.*,
        sc.name AS category_name
      FROM services s
      LEFT JOIN service_categories sc ON s.category_id = sc.id
      WHERE s.id = ?
      `,
      [req.params.id]
    );

    if (services.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = services[0];

    // Get work orders history for this service (via work_order_services o legacy service_id)
    const [workOrders] = await pool.query(`
      SELECT 
        wo.id,
        wo.order_number,
        wo.title,
        wo.status,
        wo.created_at,
        wo.start_date,
        wo.completion_date,
        wo.scheduled_date,
        c.name as client_name,
        c.company_name,
        CONCAT(eb.name, ' ', em.model_name, ' - ', e.serial_number) as equipment_name,
        u.full_name as technician_name
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN equipment_models em ON e.model_id = em.id
      LEFT JOIN equipment_brands eb ON em.brand_id = eb.id
      LEFT JOIN users u ON wo.assigned_technician_id = u.id
      WHERE EXISTS (SELECT 1 FROM work_order_services wos WHERE wos.work_order_id = wo.id AND wos.service_id = ?)
         OR wo.service_id = ?
      ORDER BY wo.created_at DESC
    `, [req.params.id, req.params.id]);

    // Calculate statistics
    const totalOrders = workOrders.length;
    const completedOrders = workOrders.filter(wo => wo.status === 'completed' || wo.status === 'accepted').length;
    const inProgressOrders = workOrders.filter(wo => wo.status === 'in_progress').length;
    const totalRevenue = workOrders
      .filter(wo => wo.status === 'completed' || wo.status === 'accepted')
      .reduce((sum, wo) => sum + (parseFloat(service.standard_price) || 0), 0);

    res.json({
      ...service,
      history: workOrders,
      statistics: {
        totalOrders,
        completedOrders,
        inProgressOrders,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create service
router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'service'), async (req, res) => {
  try {
    const { code, name, description, categoryId, category, estimatedDuration, standardPrice } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const pool = await getConnection();
    const conn = await pool.getConnection();

    const normalizedCategoryId = categoryId !== undefined && categoryId !== null && categoryId !== '' ? parseInt(categoryId) : null;
    const normalizedCategory = category !== undefined ? category : null;
    let finalCode = typeof code === 'string' ? code.trim() : '';

    try {
      await conn.beginTransaction();

      // Auto-generate code if not provided: S#### (e.g. S0179)
      if (!finalCode) {
        const [rows] = await conn.query(
          "SELECT code FROM services WHERE code REGEXP '^S[0-9]{4}$' ORDER BY CAST(SUBSTRING(code,2) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE"
        );
        const lastCode = rows?.[0]?.code || 'S0000';
        const lastNum = parseInt(String(lastCode).slice(1), 10) || 0;
        const next = lastNum + 1;
        if (next > 9999) {
          await conn.rollback();
          return res.status(400).json({ error: 'Service code limit reached (S9999)' });
        }
        finalCode = `S${String(next).padStart(4, '0')}`;
      }

      // Check if code already exists
      const [existing] = await conn.query('SELECT id FROM services WHERE code = ? LIMIT 1', [finalCode]);
      if (existing.length > 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Service code already exists' });
      }

      const [result] = await conn.query(
        `
        INSERT INTO services (
          code, name, description,
          category_id, category,
          estimated_duration, standard_price
        ) VALUES (?, ?, ?, ?, COALESCE(?, (SELECT name FROM service_categories WHERE id = ?)), ?, ?)
        `,
        [
          finalCode,
          name,
          description || null,
          normalizedCategoryId,
          normalizedCategory || null,
          normalizedCategoryId,
          estimatedDuration || null,
          standardPrice || null
        ]
      );

      await conn.commit();
      res.status(201).json({ id: result.insertId, code: finalCode, message: 'Service created successfully' });
    } catch (err) {
      try {
        await conn.rollback();
      } catch (_) {
        // ignore rollback errors
      }
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update service
router.put('/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'service'), async (req, res) => {
  try {
    const { code, name, description, categoryId, category, estimatedDuration, standardPrice, costPrice, laborCost, materialCost, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (code !== undefined) {
      updateFields.push('code = ?');
      updateValues.push(code);
    }
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (categoryId !== undefined) {
      const normalizedCategoryId = categoryId !== null && categoryId !== '' ? parseInt(categoryId) : null;
      updateFields.push('category_id = ?');
      updateValues.push(normalizedCategoryId);

      // Keep legacy text column in sync for display/backward compatibility
      if (normalizedCategoryId === null) {
        updateFields.push('category = ?');
        updateValues.push(category !== undefined ? category : null);
      } else {
        updateFields.push('category = (SELECT name FROM service_categories WHERE id = ?)');
        updateValues.push(normalizedCategoryId);
      }
    } else if (category !== undefined) {
      // Backward compatibility: allow setting category text directly
      updateFields.push('category = ?');
      updateValues.push(category);
    }
    if (estimatedDuration !== undefined) {
      updateFields.push('estimated_duration = ?');
      updateValues.push(estimatedDuration);
    }
    if (standardPrice !== undefined) {
      updateFields.push('standard_price = ?');
      updateValues.push(standardPrice);
    }
    if (costPrice !== undefined) {
      updateFields.push('cost_price = ?');
      updateValues.push(costPrice);
    }
    if (laborCost !== undefined) {
      updateFields.push('labor_cost = ?');
      updateValues.push(laborCost);
    }
    if (materialCost !== undefined) {
      updateFields.push('material_cost = ?');
      updateValues.push(materialCost);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.params.id);
    await pool.query(`UPDATE services SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    res.json({ message: 'Service updated successfully' });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete service (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), activityLogger('DELETE', 'service'), async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.query('UPDATE services SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Service deactivated successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

