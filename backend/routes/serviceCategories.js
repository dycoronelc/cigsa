import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

const router = express.Router();

// Get all active categories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [rows] = await pool.query(
      'SELECT id, name, description, is_active, created_at, updated_at FROM service_categories WHERE is_active = TRUE ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get service categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category
router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'service_category'), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const pool = await getConnection();
    const [existing] = await pool.query('SELECT id FROM service_categories WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Category name already exists' });
    }

    const [result] = await pool.query(
      'INSERT INTO service_categories (name, description) VALUES (?, ?)',
      [name.trim(), description || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Category created successfully' });
  } catch (error) {
    console.error('Create service category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category
router.put('/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'service_category'), async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      // Enforce uniqueness
      const [existing] = await pool.query(
        'SELECT id FROM service_categories WHERE name = ? AND id <> ?',
        [name.trim(), req.params.id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Category name already exists' });
      }

      updateFields.push('name = ?');
      updateValues.push(name.trim());
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }

    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.params.id);
    await pool.query(`UPDATE service_categories SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error('Update service category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), activityLogger('DELETE', 'service_category'), async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.query('UPDATE service_categories SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deactivated successfully' });
  } catch (error) {
    console.error('Delete service category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

