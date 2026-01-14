import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard KPIs (admin only)
router.get('/kpis', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const pool = await getConnection();
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE wo.created_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    
    // Total work orders
    const [totalOrders] = await pool.query(
      `SELECT COUNT(*) as total FROM work_orders wo ${dateFilter}`,
      params
    );
    
    // Orders by status
    const [ordersByStatus] = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM work_orders wo 
       ${dateFilter}
       GROUP BY status`,
      params
    );
    
    // Orders by priority
    const [ordersByPriority] = await pool.query(
      `SELECT priority, COUNT(*) as count 
       FROM work_orders wo 
       ${dateFilter}
       GROUP BY priority`,
      params
    );
    
    // Completed orders this month
    const [completedThisMonth] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM work_orders 
       WHERE status IN ('completed', 'accepted') 
       AND MONTH(completion_date) = MONTH(CURRENT_DATE())
       AND YEAR(completion_date) = YEAR(CURRENT_DATE())`
    );
    
    // Average completion time
    const [avgCompletion] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(HOUR, start_date, completion_date)) as avg_hours
       FROM work_orders 
       WHERE completion_date IS NOT NULL AND start_date IS NOT NULL
       ${dateFilter.replace('wo.created_at', 'wo.completion_date')}`,
      params
    );
    
    // Technician productivity
    const [technicianProductivity] = await pool.query(
      `SELECT 
        u.id,
        u.full_name,
        COUNT(wo.id) as total_orders,
        SUM(CASE WHEN wo.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN wo.status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        AVG(CASE WHEN wo.completion_date IS NOT NULL AND wo.start_date IS NOT NULL 
            THEN TIMESTAMPDIFF(HOUR, wo.start_date, wo.completion_date) 
            ELSE NULL END) as avg_completion_hours
       FROM users u
       LEFT JOIN work_orders wo ON u.id = wo.assigned_technician_id
       WHERE u.role = 'technician' AND u.is_active = TRUE
       ${dateFilter ? 'AND wo.created_at BETWEEN ? AND ?' : ''}
       GROUP BY u.id, u.full_name
       ORDER BY completed DESC`,
      params
    );
    
    // Orders by client
    const [ordersByClient] = await pool.query(
      `SELECT 
        c.id,
        c.name,
        c.company_name,
        COUNT(wo.id) as order_count,
        SUM(CASE WHEN wo.status IN ('completed', 'accepted') THEN 1 ELSE 0 END) as completed_count
       FROM clients c
       LEFT JOIN work_orders wo ON c.id = wo.client_id
       ${dateFilter ? 'WHERE wo.created_at BETWEEN ? AND ?' : ''}
       GROUP BY c.id, c.name, c.company_name
       ORDER BY order_count DESC
       LIMIT 10`,
      params
    );
    
    // Recent activity
    const [recentActivity] = await pool.query(
      `SELECT al.*, u.full_name as user_name
       FROM activity_log al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 50`
    );
    
    // Financial KPIs (if you add cost fields later)
    const [financialData] = await pool.query(
      `SELECT 
        COUNT(*) as total_billable,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as ready_to_invoice
       FROM work_orders
       WHERE status IN ('completed', 'accepted')`
    );
    
    // Equipment statistics
    const [equipmentStats] = await pool.query(
      `SELECT 
        COUNT(DISTINCT eb.id) as total_brands,
        COUNT(DISTINCT em.id) as total_models,
        COUNT(e.id) as total_equipment,
        COUNT(CASE WHEN e.client_id IS NOT NULL THEN 1 END) as assigned_equipment
       FROM equipment_brands eb
       LEFT JOIN equipment_models em ON eb.id = em.brand_id AND em.is_active = TRUE
       LEFT JOIN equipment e ON em.id = e.model_id AND e.is_active = TRUE
       WHERE eb.is_active = TRUE`
    );
    
    // Services statistics
    const [servicesStats] = await pool.query(
      `SELECT 
        COUNT(*) as total_services,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_services
       FROM services`
    );
    
    // Technicians statistics
    const [techniciansStats] = await pool.query(
      `SELECT 
        COUNT(*) as total_technicians,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_technicians
       FROM users
       WHERE role = 'technician'`
    );
    
    res.json({
      totalOrders: totalOrders[0].total,
      ordersByStatus: ordersByStatus.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {}),
      ordersByPriority: ordersByPriority.reduce((acc, item) => {
        acc[item.priority] = item.count;
        return acc;
      }, {}),
      completedThisMonth: completedThisMonth[0].count,
      avgCompletionHours: avgCompletion[0].avg_hours || 0,
      technicianProductivity,
      ordersByClient,
      recentActivity,
      financial: financialData[0],
      equipment: equipmentStats[0],
      services: servicesStats[0],
      technicians: techniciansStats[0]
    });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity log (bitácora)
router.get('/activity-log', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, userId, action, entityType } = req.query;
    const pool = await getConnection();
    
    let query = `
      SELECT al.*, u.full_name as user_name, u.username
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (userId) {
      query += ' AND al.user_id = ?';
      params.push(userId);
    }
    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }
    if (entityType) {
      query += ' AND al.entity_type = ?';
      params.push(entityType);
    }
    
    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [logs] = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM activity_log WHERE 1=1';
    const countParams = [];
    
    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }
    if (action) {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }
    if (entityType) {
      countQuery += ' AND entity_type = ?';
      countParams.push(entityType);
    }
    
    const [countResult] = await pool.query(countQuery, countParams);
    
    res.json({
      logs,
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get technician dashboard data
router.get('/technician/:id', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const technicianId = req.params.id;
    
    // Check if user is requesting their own data or is admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(technicianId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get assigned orders
    const [orders] = await pool.query(
      `SELECT 
        wo.*, 
        c.name as client_name,
        e.serial_number as equipment_serial,
        em.model_name as equipment_model,
        eb.name as equipment_brand
       FROM work_orders wo
       LEFT JOIN clients c ON wo.client_id = c.id
       LEFT JOIN equipment e ON wo.equipment_id = e.id
       LEFT JOIN equipment_models em ON e.model_id = em.id
       LEFT JOIN equipment_brands eb ON em.brand_id = eb.id
       WHERE wo.assigned_technician_id = ?
       ORDER BY wo.created_at DESC`,
      [technicianId]
    );
    
    // Get statistics
    const [stats] = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted
       FROM work_orders
       WHERE assigned_technician_id = ?`,
      [technicianId]
    );
    
    res.json({
      orders,
      stats: stats[0]
    });
  } catch (error) {
    console.error('Get technician dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

