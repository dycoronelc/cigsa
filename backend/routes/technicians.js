import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all technicians
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [technicians] = await pool.query(
      `SELECT id, username, email, full_name, phone, is_active, created_at 
       FROM users 
       WHERE role = 'technician' AND is_active = TRUE 
       ORDER BY full_name`
    );
    res.json(technicians);
  } catch (error) {
    console.error('Get technicians error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get technician by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [technicians] = await pool.query(
      `SELECT id, username, email, full_name, phone, is_active, created_at 
       FROM users 
       WHERE id = ? AND role = 'technician'`,
      [req.params.id]
    );

    if (technicians.length === 0) {
      return res.status(404).json({ error: 'Technician not found' });
    }

    res.json(technicians[0]);
  } catch (error) {
    console.error('Get technician error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get technician statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const technicianId = req.params.id;

    const [stats] = await pool.query(
      `SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_orders,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_orders
       FROM work_orders 
       WHERE assigned_technician_id = ?`,
      [technicianId]
    );

    res.json(stats[0] || { total_orders: 0, completed_orders: 0, in_progress_orders: 0, accepted_orders: 0 });
  } catch (error) {
    console.error('Get technician stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

