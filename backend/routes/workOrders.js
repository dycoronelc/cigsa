import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger, logActivity } from '../middleware/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = file.fieldname === 'document' 
      ? path.join(__dirname, '..', 'uploads', 'documents')
      : path.join(__dirname, '..', 'uploads', 'photos');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all work orders (admin sees all, technician sees only assigned)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    let query = `
      SELECT 
        wo.*,
        c.name as client_name,
        c.company_name,
        e.serial_number,
        CONCAT(eb.name, ' ', em.model_name, ' - ', e.serial_number) as equipment_name,
        em.model_name,
        eb.name as brand_name,
        u.full_name as technician_name,
        creator.full_name as created_by_name
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN equipment_models em ON e.model_id = em.id
      LEFT JOIN equipment_brands eb ON em.brand_id = eb.id
      LEFT JOIN users u ON wo.assigned_technician_id = u.id
      LEFT JOIN users creator ON wo.created_by = creator.id
    `;
    
    const params = [];
    
    if (req.user.role === 'technician') {
      query += ' WHERE wo.assigned_technician_id = ?';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY wo.created_at DESC';
    
    const [orders] = await pool.query(query, params);
    res.json(orders);
  } catch (error) {
    console.error('Get work orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get work order by ID with all details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Get work order
    const [orders] = await pool.query(`
      SELECT 
        wo.*,
        c.name as client_name,
        c.company_name,
        c.email as client_email,
        c.phone as client_phone,
        e.serial_number,
        e.description as equipment_description,
        CONCAT(eb.name, ' ', em.model_name, ' - ', e.serial_number) as equipment_name,
        em.model_name,
        em.components as equipment_components,
        eb.name as brand_name,
        eb.id as brand_id,
        em.id as model_id,
        u.full_name as technician_name,
        u.phone as technician_phone,
        creator.full_name as created_by_name
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN equipment_models em ON e.model_id = em.id
      LEFT JOIN equipment_brands eb ON em.brand_id = eb.id
      LEFT JOIN users u ON wo.assigned_technician_id = u.id
      LEFT JOIN users creator ON wo.created_by = creator.id
      WHERE wo.id = ?
    `, [req.params.id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    const order = orders[0];

    // Get work order services (múltiples servicios por OT)
    let orderServices = [];
    try {
      const [wosRows] = await pool.query(`
        SELECT wos.id, wos.service_id, wos.housing_count, s.name as service_name, s.code as service_code, s.description as service_description
        FROM work_order_services wos
        LEFT JOIN services s ON wos.service_id = s.id
        WHERE wos.work_order_id = ?
        ORDER BY wos.id
      `, [req.params.id]);
      orderServices = wosRows || [];
    } catch (err) {
      console.error('Error fetching work order services:', err);
    }
    // Backward compat: if no work_order_services but has legacy service_id, include it
    if (orderServices.length === 0 && order.service_id) {
      const [legacy] = await pool.query(
        'SELECT id, name as service_name, code as service_code, description as service_description FROM services WHERE id = ?',
        [order.service_id]
      );
      if (legacy.length > 0) {
        orderServices = [{ service_id: order.service_id, housing_count: order.service_housing_count || 0, ...legacy[0] }];
      }
    }
    
    // Check permissions
    if (req.user.role === 'technician' && order.assigned_technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get measurements
    const [measurements] = await pool.query(
      'SELECT * FROM measurements WHERE work_order_id = ? ORDER BY measurement_date',
      [req.params.id]
    );

    // Get service housings (flat list para mediciones; también por servicio)
    let serviceHousings = [];
    try {
      const [rows] = await pool.query(
        'SELECT * FROM work_order_housings WHERE work_order_id = ? ORDER BY work_order_service_id, id',
        [req.params.id]
      );
      serviceHousings = rows || [];
    } catch (error) {
      console.error('Error fetching work order housings:', error);
      serviceHousings = [];
    }
    // Adjuntar housings a cada servicio
    orderServices.forEach((svc, idx) => {
      if (svc.id) {
        svc.housings = serviceHousings.filter((h) => h.work_order_service_id === svc.id);
      } else if (idx === 0) {
        svc.housings = serviceHousings.filter((h) => h.work_order_service_id == null);
      } else {
        svc.housings = [];
      }
    });

    // Get housing measurements linked to measurement events
    let housingMeasurementsByMeasurementId = new Map();
    try {
      const [rows] = await pool.query(`
        SELECT 
          wohm.*,
          woh.measure_code,
          woh.description as housing_description,
          woh.nominal_value,
          woh.nominal_unit,
          woh.tolerance
        FROM work_order_housing_measurements wohm
        JOIN work_order_housings woh ON wohm.housing_id = woh.id
        JOIN measurements m ON wohm.measurement_id = m.id
        WHERE m.work_order_id = ?
        ORDER BY woh.id
      `, [req.params.id]);

      (rows || []).forEach((r) => {
        const key = r.measurement_id;
        if (!housingMeasurementsByMeasurementId.has(key)) {
          housingMeasurementsByMeasurementId.set(key, []);
        }
        housingMeasurementsByMeasurementId.get(key).push(r);
      });
    } catch (error) {
      console.error('Error fetching housing measurements:', error);
      housingMeasurementsByMeasurementId = new Map();
    }

    const measurementsWithHousing = (measurements || []).map((m) => ({
      ...m,
      housing_measurements: housingMeasurementsByMeasurementId.get(m.id) || []
    }));
    
    // Get photos
    const [photos] = await pool.query(
      'SELECT * FROM work_order_photos WHERE work_order_id = ? ORDER BY created_at',
      [req.params.id]
    );
    
    // Get observations
    const [observations] = await pool.query(`
      SELECT wo.*, u.full_name as created_by_name 
      FROM work_order_observations wo
      LEFT JOIN users u ON wo.created_by = u.id
      WHERE wo.work_order_id = ? 
      ORDER BY wo.created_at
    `, [req.params.id]);
    
    // Get documents - include equipment documents and work order specific documents
    let documents = [];
    try {
      const [docResults] = await pool.query(`
        SELECT 
          wod.*,
          ed.brand_id as equipment_brand_id,
          ed.model_id as equipment_model_id,
          ed.housing_id as equipment_housing_id,
          CASE 
            WHEN wodp.id IS NOT NULL THEN wodp.is_visible_to_technician
            ELSE TRUE
          END as is_visible_to_technician
        FROM work_order_documents wod
        LEFT JOIN equipment_documents ed ON wod.equipment_document_id = ed.id
        LEFT JOIN work_order_document_permissions wodp ON wod.id = wodp.document_id AND wodp.work_order_id = ?
        WHERE wod.work_order_id = ? OR wod.equipment_id = ?
        ORDER BY wod.created_at
      `, [req.params.id, req.params.id, order.equipment_id]);
      documents = docResults || [];
    } catch (error) {
      console.error('Error fetching work order documents:', error);
      documents = [];
    }
    
    // Also get equipment documents that should be available for this equipment
    if (order.equipment_id) {
      // Get equipment details to find brand, model, housing
      const [equipDetails] = await pool.query(`
        SELECT e.housing_id, em.brand_id, em.id as model_id
        FROM equipment e
        JOIN equipment_models em ON e.model_id = em.id
        WHERE e.id = ?
      `, [order.equipment_id]);
      
      if (equipDetails.length > 0) {
        const eq = equipDetails[0];
        // Get equipment documents for this brand, model, and housing
        const [equipDocs] = await pool.query(`
          SELECT ed.*, 
            CASE 
              WHEN wodp.id IS NOT NULL THEN wodp.is_visible_to_technician
              ELSE TRUE
            END as is_visible_to_technician
          FROM equipment_documents ed
          LEFT JOIN work_order_documents wod ON wod.equipment_document_id = ed.id AND wod.work_order_id = ?
          LEFT JOIN work_order_document_permissions wodp ON wod.id = wodp.document_id AND wodp.work_order_id = ?
          WHERE (ed.brand_id = ? OR ed.model_id = ? OR ed.housing_id = ?)
            AND wod.id IS NULL
        `, [req.params.id, req.params.id, eq.brand_id, eq.model_id, eq.housing_id || -1]);
        
        // Add equipment documents that aren't already in documents array
        const existingDocIds = new Set(documents.map(d => d.equipment_document_id).filter(Boolean));
        equipDocs.forEach(ed => {
          if (!existingDocIds.has(ed.id)) {
            documents.push({
              ...ed,
              id: `equip_${ed.id}`,
              is_equipment_document: true
            });
          }
        });
      }
    }

    // For technicians: only return documents marked visible.
    // MySQL may return BOOLEAN as 0/1; treat null/undefined as visible (default).
    const isVisibleToTechnician = (v) => {
      if (v === undefined || v === null) return true;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
      return Boolean(v);
    };
    if (req.user?.role === 'technician') {
      documents = documents.filter((d) => isVisibleToTechnician(d.is_visible_to_technician));
    }

    let conformitySignature = null;
    try {
      const [sigRows] = await pool.query(
        'SELECT id, signed_by_name, signed_at FROM work_order_conformity_signatures WHERE work_order_id = ? ORDER BY signed_at DESC LIMIT 1',
        [req.params.id]
      );
      conformitySignature = sigRows[0] || null;
    } catch (e) { /* ignore */ }
    
    res.json({
      ...order,
      services: orderServices,
      service_housings: serviceHousings,
      measurements: measurementsWithHousing,
      photos,
      observations,
      documents,
      conformity_signature: conformitySignature
    });
  } catch (error) {
    console.error('Get work order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create work order
router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'work_order'), async (req, res) => {
  try {
    const { clientId, equipmentId, services, serviceLocation, clientServiceOrderNumber, title, description, priority, scheduledDate, assignedTechnicianId } = req.body;
    
    if (!clientId || !equipmentId || !title) {
      return res.status(400).json({ error: 'Client, equipment, and title are required' });
    }

    // services: [{ serviceId, housingCount, housings: [{ measureCode, description, ... }] }] - housings por servicio
    const servicesList = Array.isArray(services) && services.length > 0
      ? services.filter(s => s.serviceId)
      : [];
    const totalHousingCount = servicesList.reduce((sum, s) => sum + (Array.isArray(s.housings) ? s.housings.length : 0), 0);
    
    const pool = await getConnection();
    
    // Generate order number
    const [count] = await pool.query('SELECT COUNT(*) as count FROM work_orders');
    const nextNum = Number(count[0]?.count ?? 0) + 1;
    const orderNumber = `OT-${String(nextNum).padStart(6, '0')}`;
    
    const [result] = await pool.query(
      `INSERT INTO work_orders 
       (order_number, client_id, equipment_id, service_location, client_service_order_number, service_housing_count, assigned_technician_id, title, description, priority, scheduled_date, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber,
        clientId,
        equipmentId,
        serviceLocation || null,
        clientServiceOrderNumber || null,
        totalHousingCount,
        assignedTechnicianId || null,
        title,
        description || null,
        priority || 'medium',
        scheduledDate || null,
        req.user.id,
        assignedTechnicianId ? 'assigned' : 'created'
      ]
    );

    // Insert work_order_services y housings por cada servicio
    if (servicesList.length > 0) {
      for (const s of servicesList) {
        const housingCount = Number(s.housingCount) || 0;
        const [wosRes] = await pool.query(
          'INSERT INTO work_order_services (work_order_id, service_id, housing_count) VALUES (?, ?, ?)',
          [result.insertId, s.serviceId, housingCount]
        );
        const wosId = wosRes.insertId;
        const housings = Array.isArray(s.housings) ? s.housings : [];
        if (housings.length > 0) {
          const hasMeasureCode = (h) => (h.measureCode || h.measure_code || '').toString().trim();
          if (housings.some(h => !hasMeasureCode(h))) {
            return res.status(400).json({ error: 'Cada alojamiento debe tener un campo Medida (A, B, C...)' });
          }
          const valuesNew = housings.map((h) => ([
            result.insertId,
            wosId,
            h.measureCode || h.measure_code || null,
            h.description || null,
            h.nominalValue !== undefined && h.nominalValue !== null && h.nominalValue !== '' ? h.nominalValue : null,
            h.unit || h.nominalUnit || h.nominal_unit || null,
            h.tolerance || null
          ]));
          try {
            await pool.query(
              `INSERT INTO work_order_housings (work_order_id, work_order_service_id, measure_code, description, nominal_value, nominal_unit, tolerance)
               VALUES ?`,
              [valuesNew]
            );
          } catch (housingsErr) {
            if (housingsErr.code === 'ER_BAD_FIELD_ERROR' && housingsErr.sqlMessage && housingsErr.sqlMessage.includes('work_order_service_id')) {
              const valuesOld = housings.map((h) => ([
                result.insertId,
                h.measureCode || h.measure_code || null,
                h.description || null,
                h.nominalValue !== undefined && h.nominalValue !== null && h.nominalValue !== '' ? h.nominalValue : null,
                h.unit || h.nominalUnit || h.nominal_unit || null,
                h.tolerance || null
              ]));
              await pool.query(
                `INSERT INTO work_order_housings (work_order_id, measure_code, description, nominal_value, nominal_unit, tolerance)
                 VALUES ?`,
                [valuesOld]
              );
            } else {
              throw housingsErr;
            }
          }
        }
      }
    }
    
    await logActivity(req.user.id, 'CREATE', 'work_order', result.insertId, 'Orden creada', req.ip);
    
    res.status(201).json({ id: result.insertId, orderNumber, message: 'Work order created successfully' });
  } catch (error) {
    console.error('Create work order error:', error);
    const msg = error.sqlMessage || error.message || 'Internal server error';
    res.status(500).json({ error: msg });
  }
});

// Update work order
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, priority, scheduledDate, assignedTechnicianId, status, serviceLocation, services, clientServiceOrderNumber, equipmentId } = req.body;
    const pool = await getConnection();
    
    // Check permissions
    const [orders] = await pool.query('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    const order = orders[0];
    
    // Technicians can only update status and start/completion dates
    if (req.user.role === 'technician') {
      if (order.assigned_technician_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const updateFields = [];
      const updateValues = [];
      
      if (status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(status);
        
        if (status === 'in_progress' && !order.start_date) {
          updateFields.push('start_date = NOW()');
        }
        if (status === 'completed' && !order.completion_date) {
          updateFields.push('completion_date = NOW()');
        }
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      updateValues.push(req.params.id);
      await pool.query(`UPDATE work_orders SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
      const statusDesc = { in_progress: 'Orden puesta en proceso', completed: 'Orden completada', accepted: 'Orden aceptada', on_hold: 'Orden puesta en espera', cancelled: 'Orden cancelada' };
      const desc = statusDesc[status] || `Estado actualizado a ${status}`;
      await logActivity(req.user.id, 'UPDATE', 'work_order', req.params.id, desc, req.ip);
      return res.json({ message: 'Work order updated successfully' });
    }
    
    // Admin can update all fields
    const updateFields = [];
    const updateValues = [];
    
    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    // Update work_order_services y housings (múltiples servicios por OT)
    if (services !== undefined && Array.isArray(services)) {
      await pool.query('DELETE FROM work_order_services WHERE work_order_id = ?', [req.params.id]);
      const servicesList = services.filter(s => s && s.serviceId);
      for (const s of servicesList) {
        const housingCount = Number(s.housingCount) || 0;
        const [wosRes] = await pool.query(
          'INSERT INTO work_order_services (work_order_id, service_id, housing_count) VALUES (?, ?, ?)',
          [req.params.id, s.serviceId, housingCount]
        );
        const housings = Array.isArray(s.housings) ? s.housings : [];
        if (housings.length > 0) {
          const values = housings.map((h) => ([
            req.params.id,
            wosRes.insertId,
            h.measureCode || h.measure_code || null,
            h.description || null,
            h.nominalValue !== undefined && h.nominalValue !== null && h.nominalValue !== '' ? h.nominalValue : null,
            h.unit || h.nominalUnit || h.nominal_unit || null,
            h.tolerance || null
          ]));
          if (values.every(v => v[2])) {
            await pool.query(
              `INSERT INTO work_order_housings (work_order_id, work_order_service_id, measure_code, description, nominal_value, nominal_unit, tolerance)
               VALUES ?`,
              [values]
            );
          }
        }
      }
    }
    if (serviceLocation !== undefined) {
      updateFields.push('service_location = ?');
      updateValues.push(serviceLocation || null);
    }
    if (equipmentId !== undefined) {
      const nextEquipmentId = equipmentId ? parseInt(equipmentId) : null;
      if (!nextEquipmentId) {
        return res.status(400).json({ error: 'Equipo es requerido' });
      }
      // Validate equipment belongs to same client for this work order (safety)
      const [eqRows] = await pool.query('SELECT id, client_id FROM equipment WHERE id = ? LIMIT 1', [nextEquipmentId]);
      if (eqRows.length === 0) {
        return res.status(404).json({ error: 'Equipo no encontrado' });
      }
      if (order.client_id && eqRows[0].client_id && Number(eqRows[0].client_id) !== Number(order.client_id)) {
        return res.status(400).json({ error: 'El equipo seleccionado no pertenece al cliente de esta OT' });
      }
      updateFields.push('equipment_id = ?');
      updateValues.push(nextEquipmentId);
    }
    if (clientServiceOrderNumber !== undefined) {
      updateFields.push('client_service_order_number = ?');
      updateValues.push(clientServiceOrderNumber || null);
    }
    if (scheduledDate !== undefined) {
      updateFields.push('scheduled_date = ?');
      updateValues.push(scheduledDate);
    }
    if (assignedTechnicianId !== undefined) {
      updateFields.push('assigned_technician_id = ?');
      updateFields.push('status = ?');
      updateValues.push(assignedTechnicianId);
      updateValues.push(assignedTechnicianId ? 'assigned' : 'created');
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
      
      if (status === 'in_progress' && !order.start_date) {
        updateFields.push('start_date = NOW()');
      }
      if (status === 'completed' && !order.completion_date) {
        updateFields.push('completion_date = NOW()');
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateValues.push(req.params.id);
    await pool.query(`UPDATE work_orders SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
    if (status !== undefined) {
      const statusDesc = { in_progress: 'Orden puesta en proceso', completed: 'Orden completada', accepted: 'Orden aceptada', on_hold: 'Orden puesta en espera', cancelled: 'Orden cancelada', assigned: 'Orden asignada', created: 'Orden creada' };
      const desc = statusDesc[status] || `Estado actualizado a ${status}`;
      if (assignedTechnicianId !== undefined && assignedTechnicianId) {
        const [u] = await pool.query('SELECT full_name FROM users WHERE id = ?', [assignedTechnicianId]);
        await logActivity(req.user.id, 'UPDATE', 'work_order', req.params.id, `Orden asignada a ${u[0]?.full_name || 'técnico'}`, req.ip);
      } else {
        await logActivity(req.user.id, 'UPDATE', 'work_order', req.params.id, desc, req.ip);
      }
    } else if (assignedTechnicianId !== undefined && assignedTechnicianId) {
      const [u] = await pool.query('SELECT full_name FROM users WHERE id = ?', [assignedTechnicianId]);
      await logActivity(req.user.id, 'UPDATE', 'work_order', req.params.id, `Orden asignada a ${u[0]?.full_name || 'técnico'}`, req.ip);
    } else {
      await logActivity(req.user.id, 'UPDATE', 'work_order', req.params.id, 'Orden actualizada', req.ip);
    }
    res.json({ message: 'Work order updated successfully' });
  } catch (error) {
    console.error('Update work order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add measurement (initial or final)
router.post('/:id/measurements', authenticateToken, async (req, res) => {
  try {
    const { measurementType, temperature, pressure, voltage, current, resistance, otherMeasurements, notes, housingMeasurements } = req.body;
    
    if (!measurementType || !['initial', 'final'].includes(measurementType)) {
      return res.status(400).json({ error: 'Valid measurement type (initial/final) is required' });
    }
    
    const pool = await getConnection();
    
    // Check permissions
    const [orders] = await pool.query('SELECT assigned_technician_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    if (req.user.role === 'technician' && orders[0].assigned_technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO measurements 
       (work_order_id, measurement_type, measurement_date, temperature, pressure, voltage, current, resistance, other_measurements, notes, taken_by)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        measurementType,
        temperature || null,
        pressure || null,
        voltage || null,
        current || null,
        resistance || null,
        otherMeasurements ? JSON.stringify(otherMeasurements) : null,
        notes || null,
        req.user.id
      ]
    );

    // Insert housing measurements if provided (new feature)
    if (Array.isArray(housingMeasurements) && housingMeasurements.length > 0) {
      const values = housingMeasurements.map((hm) => ([
        result.insertId,
        hm.housingId || hm.housing_id,
        hm.x1 !== undefined && hm.x1 !== null && hm.x1 !== '' ? hm.x1 : null,
        hm.y1 !== undefined && hm.y1 !== null && hm.y1 !== '' ? hm.y1 : null,
        hm.unit || null
      ]));

      // Validate housing ids exist for this work order
      const housingIds = [...new Set(values.map(v => v[1]).filter(Boolean))];
      if (housingIds.length > 0) {
        const [existing] = await pool.query(
          `SELECT id FROM work_order_housings WHERE work_order_id = ? AND id IN (?)`,
          [req.params.id, housingIds]
        );
        const existingSet = new Set(existing.map(r => r.id));
        const invalid = housingIds.filter(id => !existingSet.has(id));
        if (invalid.length > 0) {
          return res.status(400).json({ error: 'Alojamientos inválidos para esta orden' });
        }
      }

      await pool.query(
        `INSERT INTO work_order_housing_measurements (measurement_id, housing_id, x1, y1, unit)
         VALUES ?`,
        [values]
      );
    }
    
    await logActivity(req.user.id, 'CREATE', 'measurement', result.insertId, `Added ${measurementType} measurement`, req.ip);
    
    res.status(201).json({ id: result.insertId, message: 'Measurement added successfully' });
  } catch (error) {
    console.error('Add measurement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload photo
router.post('/:id/photos', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }
    
    const { photoType, description } = req.body;
    const pool = await getConnection();
    
    // Check permissions
    const [orders] = await pool.query('SELECT assigned_technician_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    if (req.user.role === 'technician' && orders[0].assigned_technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO work_order_photos (work_order_id, photo_path, photo_type, description, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.params.id,
        `/uploads/photos/${req.file.filename}`,
        photoType || 'during_service',
        description || null,
        req.user.id
      ]
    );
    
    await logActivity(req.user.id, 'CREATE', 'photo', result.insertId, 'Uploaded photo', req.ip);
    
    res.status(201).json({ 
      id: result.insertId, 
      photoPath: `/uploads/photos/${req.file.filename}`,
      message: 'Photo uploaded successfully' 
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete photo
router.delete('/:id/photos/:photoId', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [orders] = await pool.query('SELECT assigned_technician_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    if (req.user.role === 'technician' && orders[0].assigned_technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const [photos] = await pool.query(
      'SELECT id, photo_path FROM work_order_photos WHERE work_order_id = ? AND id = ?',
      [req.params.id, req.params.photoId]
    );
    if (photos.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const photoPath = photos[0].photo_path;
    await pool.query('DELETE FROM work_order_photos WHERE id = ?', [req.params.photoId]);
    await logActivity(req.user.id, 'DELETE', 'photo', parseInt(req.params.photoId), 'Deleted photo', req.ip);
    const filename = path.basename(photoPath);
    const filePath = path.join(__dirname, '..', 'uploads', 'photos', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(200).json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add observation
router.post('/:id/observations', authenticateToken, async (req, res) => {
  try {
    const { observation, observationType } = req.body;
    
    if (!observation) {
      return res.status(400).json({ error: 'Observation text is required' });
    }
    
    const pool = await getConnection();
    
    // Check permissions
    const [orders] = await pool.query('SELECT assigned_technician_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    if (req.user.role === 'technician' && orders[0].assigned_technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO work_order_observations (work_order_id, observation, observation_type, created_by)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, observation, observationType || 'general', req.user.id]
    );
    
    await logActivity(req.user.id, 'CREATE', 'observation', result.insertId, 'Added observation', req.ip);
    
    res.status(201).json({ id: result.insertId, message: 'Observation added successfully' });
  } catch (error) {
    console.error('Add observation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload document
router.post('/:id/documents', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' });
    }
    
    const { documentType, description, equipmentId } = req.body;
    const pool = await getConnection();
    
    // Check permissions
    const [orders] = await pool.query('SELECT equipment_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO work_order_documents 
       (work_order_id, equipment_id, document_type, file_path, file_name, file_size, mime_type, description, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        equipmentId || orders[0].equipment_id,
        documentType || 'other',
        `/uploads/documents/${req.file.filename}`,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        description || null,
        req.user.id
      ]
    );
    
    await logActivity(req.user.id, 'CREATE', 'document', result.insertId, 'Uploaded document', req.ip);
    
    res.status(201).json({ 
      id: result.insertId, 
      filePath: `/uploads/documents/${req.file.filename}`,
      message: 'Document uploaded successfully' 
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity log for work order (Bitácora)
router.get('/:id/activity', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [orders] = await pool.query('SELECT assigned_technician_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Work order not found' });
    if (req.user.role === 'technician' && orders[0].assigned_technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const [logs] = await pool.query(`
      SELECT al.*, u.full_name as user_name
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'work_order' AND al.entity_id = ?
      ORDER BY al.created_at ASC
    `, [req.params.id]);
    res.json(logs);
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Firma de conformidad (supervisor del cliente)
router.post('/:id/conformity-signature', authenticateToken, async (req, res) => {
  try {
    const { signatureData, signedBy } = req.body;
    if (!signatureData || !signedBy || typeof signedBy !== 'string' || signedBy.trim() === '') {
      return res.status(400).json({ error: 'Se requiere firma y nombre del supervisor' });
    }
    const pool = await getConnection();
    const [orders] = await pool.query('SELECT id, assigned_technician_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Work order not found' });
    if (req.user.role === 'technician' && orders[0].assigned_technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await pool.query(
      'INSERT INTO work_order_conformity_signatures (work_order_id, signature_data, signed_by_name) VALUES (?, ?, ?)',
      [req.params.id, signatureData, signedBy.trim()]
    );
    await logActivity(req.user.id, 'CONFORMITY_SIGNATURE', 'work_order', req.params.id, `Firma de conformidad por ${signedBy.trim()}`, req.ip);
    res.status(201).json({ message: 'Firma de conformidad registrada' });
  } catch (error) {
    console.error('Conformity signature error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conformity signature for work order
router.get('/:id/conformity-signature', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [orders] = await pool.query('SELECT assigned_technician_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Work order not found' });
    if (req.user.role === 'technician' && orders[0].assigned_technician_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const [rows] = await pool.query(
      'SELECT id, signature_data, signed_by_name, signed_at FROM work_order_conformity_signatures WHERE work_order_id = ? ORDER BY signed_at DESC LIMIT 1',
      [req.params.id]
    );
    res.json(rows[0] || null);
  } catch (error) {
    console.error('Get conformity signature error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update document permissions for work order
router.put('/:id/documents/permissions', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { documentPermissions } = req.body; // Array of { documentId, isVisibleToTechnician }
    const pool = await getConnection();
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();

      // Verify work order exists (and grab equipment_id for linking equipment documents if needed)
      const [orders] = await conn.query('SELECT id, equipment_id FROM work_orders WHERE id = ?', [req.params.id]);
      if (orders.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Work order not found' });
      }
      const workOrder = orders[0];

      // Delete existing permissions for this work order
      await conn.query('DELETE FROM work_order_document_permissions WHERE work_order_id = ?', [req.params.id]);

      // Insert new permissions
      if (documentPermissions && documentPermissions.length > 0) {
        const values = [];

        for (const dp of documentPermissions) {
          if (!dp) continue;
          let documentId = dp.documentId;
          const isVisible = dp.isVisibleToTechnician ? 1 : 0;

          // Allow equipment docs IDs in the form "equip_123"
          if (typeof documentId === 'string' && documentId.startsWith('equip_')) {
            const equipmentDocumentId = parseInt(documentId.replace('equip_', ''), 10);
            if (!Number.isFinite(equipmentDocumentId)) continue;

            // Find or create a work_order_documents row linked to this equipment_document_id
            const [existingWod] = await conn.query(
              'SELECT id FROM work_order_documents WHERE work_order_id = ? AND equipment_document_id = ? LIMIT 1',
              [req.params.id, equipmentDocumentId]
            );
            if (existingWod.length > 0) {
              documentId = existingWod[0].id;
            } else {
              const [equipDocs] = await conn.query(
                'SELECT document_type, file_path, file_name, file_size, mime_type, description, uploaded_by FROM equipment_documents WHERE id = ? LIMIT 1',
                [equipmentDocumentId]
              );
              if (equipDocs.length === 0) continue;
              const ed = equipDocs[0];
              const [ins] = await conn.query(
                `INSERT INTO work_order_documents
                  (work_order_id, equipment_id, equipment_document_id, document_type, file_path, file_name, file_size, mime_type, description, uploaded_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  req.params.id,
                  workOrder.equipment_id || null,
                  equipmentDocumentId,
                  ed.document_type || 'other',
                  ed.file_path,
                  ed.file_name,
                  ed.file_size || null,
                  ed.mime_type || null,
                  ed.description || null,
                  ed.uploaded_by || null
                ]
              );
              documentId = ins.insertId;
            }
          }

          const numericId = typeof documentId === 'number' ? documentId : parseInt(documentId, 10);
          if (!Number.isFinite(numericId)) continue;
          values.push([req.params.id, numericId, isVisible]);
        }

        if (values.length > 0) {
          await conn.query(
            'INSERT INTO work_order_document_permissions (work_order_id, document_id, is_visible_to_technician) VALUES ?',
            [values]
          );
        }
      }

      await conn.commit();
      res.json({ message: 'Document permissions updated successfully' });
    } catch (err) {
      try { await conn.rollback(); } catch (_) { /* ignore */ }
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Update document permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

