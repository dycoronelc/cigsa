import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

const router = express.Router();

// Get all active service types
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [rows] = await pool.query(
      'SELECT id, name, is_active, created_at, updated_at FROM service_types WHERE is_active = TRUE ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get service types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create service type
router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'service_type'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del tipo de servicio es requerido' });
    }

    const pool = await getConnection();
    const [existing] = await pool.query('SELECT id FROM service_types WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ya existe un tipo de servicio con ese nombre' });
    }

    const [result] = await pool.query(
      'INSERT INTO service_types (name) VALUES (?)',
      [name.trim()]
    );

    res.status(201).json({ id: result.insertId, message: 'Tipo de servicio creado correctamente' });
  } catch (error) {
    console.error('Create service type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update service type
router.put('/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'service_type'), async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre del tipo de servicio es requerido' });
      }
      const [existing] = await pool.query(
        'SELECT id FROM service_types WHERE name = ? AND id <> ?',
        [name.trim(), req.params.id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Ya existe un tipo de servicio con ese nombre' });
      }
      updateFields.push('name = ?');
      updateValues.push(name.trim());
    }

    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateValues.push(req.params.id);
    await pool.query(`UPDATE service_types SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    res.json({ message: 'Tipo de servicio actualizado correctamente' });
  } catch (error) {
    console.error('Update service type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), activityLogger('DELETE', 'service_type'), async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.query('UPDATE service_types SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tipo de servicio desactivado correctamente' });
  } catch (error) {
    console.error('Delete service type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
