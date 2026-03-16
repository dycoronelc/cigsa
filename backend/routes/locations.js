import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

const router = express.Router();

// Get all active locations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [rows] = await pool.query(
      'SELECT id, name, is_active, created_at, updated_at FROM locations WHERE is_active = TRUE ORDER BY name'
    );
    res.json(rows);
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create location
router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'location'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la ubicación es requerido' });
    }

    const pool = await getConnection();
    const [existing] = await pool.query('SELECT id FROM locations WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ya existe una ubicación con ese nombre' });
    }

    const [result] = await pool.query(
      'INSERT INTO locations (name) VALUES (?)',
      [name.trim()]
    );

    res.status(201).json({ id: result.insertId, message: 'Ubicación creada correctamente' });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update location
router.put('/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'location'), async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre de la ubicación es requerido' });
      }
      const [existing] = await pool.query(
        'SELECT id FROM locations WHERE name = ? AND id <> ?',
        [name.trim(), req.params.id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Ya existe una ubicación con ese nombre' });
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
    await pool.query(`UPDATE locations SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    res.json({ message: 'Ubicación actualizada correctamente' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), activityLogger('DELETE', 'location'), async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.query('UPDATE locations SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Ubicación desactivada correctamente' });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
