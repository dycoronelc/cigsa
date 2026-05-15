import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';
import { GENERAL_COMPONENT_NAME } from '../lib/workOrderComponents.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const adminAll = req.user?.role === 'admin' && req.query.all === '1';
    const sql = adminAll
      ? 'SELECT id, name, description, is_system, is_active, created_at, updated_at FROM components ORDER BY name'
      : 'SELECT id, name, description, is_system, is_active FROM components WHERE is_active = TRUE ORDER BY name';
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Get components error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'component'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del componente es requerido' });
    }
    const pool = await getConnection();
    const [existing] = await pool.query('SELECT id FROM components WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ya existe un componente con ese nombre' });
    }
    const [result] = await pool.query(
      'INSERT INTO components (name, description) VALUES (?, ?)',
      [name.trim(), description?.trim() || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Componente creado correctamente' });
  } catch (error) {
    console.error('Create component error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'component'), async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    const pool = await getConnection();
    const [current] = await pool.query('SELECT is_system FROM components WHERE id = ?', [req.params.id]);
    if (current.length === 0) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre del componente es requerido' });
      }
      if (current[0].is_system && name.trim() !== GENERAL_COMPONENT_NAME) {
        return res.status(400).json({ error: `No se puede renombrar el componente de sistema «${GENERAL_COMPONENT_NAME}»` });
      }
      const [existing] = await pool.query('SELECT id FROM components WHERE name = ? AND id <> ?', [
        name.trim(),
        req.params.id
      ]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Ya existe un componente con ese nombre' });
      }
      updateFields.push('name = ?');
      updateValues.push(name.trim());
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description?.trim() || null);
    }

    if (isActive !== undefined) {
      if (current[0].is_system && !isActive) {
        return res.status(400).json({ error: `No se puede desactivar «${GENERAL_COMPONENT_NAME}»` });
      }
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateValues.push(req.params.id);
    await pool.query(`UPDATE components SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
    res.json({ message: 'Componente actualizado correctamente' });
  } catch (error) {
    console.error('Update component error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), activityLogger('DELETE', 'component'), async (req, res) => {
  try {
    const pool = await getConnection();
    const [current] = await pool.query('SELECT is_system, name FROM components WHERE id = ?', [req.params.id]);
    if (current.length === 0) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }
    if (current[0].is_system) {
      return res.status(400).json({ error: 'No se puede desactivar un componente de sistema' });
    }
    const [inUse] = await pool.query(
      'SELECT COUNT(*) AS c FROM work_order_service_components WHERE component_id = ?',
      [req.params.id]
    );
    if ((inUse[0]?.c || 0) > 0) {
      return res.status(400).json({
        error: 'El componente está en uso en órdenes de trabajo y no puede desactivarse'
      });
    }
    await pool.query('UPDATE components SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Componente desactivado correctamente' });
  } catch (error) {
    console.error('Delete component error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
