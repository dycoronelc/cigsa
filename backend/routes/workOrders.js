import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger, logActivity } from '../middleware/logger.js';
import { isMachiningRepairTypeName } from '../lib/serviceTypeMachining.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/** Normaliza datetime-local del front al formato guardado en MySQL. */
function normalizeDateTimeLocalForDb(val) {
  if (val == null || val === '') return null;
  const s = String(val).replace('T', ' ');
  return s.length === 16 ? `${s}:00` : s;
}

/**
 * Tras un PUT admin, estima inicio y fin efectivos para validar coherencia (días trabajados).
 */
function getEffectiveStartCompletionAfterPut(order, body) {
  const { startDate, completionDate, status } = body;
  let effStart = order.start_date;
  let effCompletion = order.completion_date;

  if (startDate !== undefined) {
    effStart = normalizeDateTimeLocalForDb(startDate);
  }
  if (completionDate !== undefined) {
    effCompletion = normalizeDateTimeLocalForDb(completionDate);
  }

  const willSetStartNow =
    status !== undefined && status === 'in_progress' && !order.start_date && startDate === undefined;
  const willSetCompletionNow =
    status !== undefined && status === 'completed' && !order.completion_date && completionDate === undefined;

  if (willSetStartNow) {
    effStart = new Date();
  }
  if (willSetCompletionNow) {
    effCompletion = new Date();
  }

  return { effStart, effCompletion };
}

function completionBeforeStartError(effStart, effCompletion) {
  if (!effStart || !effCompletion) return null;
  const t0 = new Date(effStart).getTime();
  const t1 = new Date(effCompletion).getTime();
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null;
  if (t1 < t0) {
    return 'La fecha de completación no puede ser anterior a la fecha de inicio.';
  }
  return null;
}

/**
 * Si existe una medición inicial (la más antigua), enlaza alojamientos de la OT que aún no tengan fila.
 * Así, servicios agregados después aparecen en Mediciones Iniciales (X1/Y1 vacíos hasta completarlos).
 */
async function linkNewHousingsToInitialMeasurement(pool, workOrderId) {
  const [initialRows] = await pool.query(
    `SELECT id FROM measurements 
     WHERE work_order_id = ? AND LOWER(COALESCE(measurement_type, '')) = 'initial' 
     ORDER BY measurement_date ASC, id ASC LIMIT 1`,
    [workOrderId]
  );
  if (!initialRows?.length) return;

  const initialMeasurementId = initialRows[0].id;
  await pool.query(
    `INSERT INTO work_order_housing_measurements (measurement_id, housing_id, x1, y1, unit)
     SELECT ?, wh.id, NULL, NULL, NULL
     FROM work_order_housings wh
     WHERE wh.work_order_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM work_order_housing_measurements x
         WHERE x.measurement_id = ? AND x.housing_id = wh.id
       )`,
    [initialMeasurementId, workOrderId, initialMeasurementId]
  );
}

const SHIFT_DAY = 'day';
const SHIFT_NIGHT = 'night';

function normalizeShift(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === SHIFT_NIGHT || s === 'ns' || s === 'noche') return SHIFT_NIGHT;
  return SHIFT_DAY;
}

/** Acceso técnico: asignación legacy en la OT o fila en work_order_service_technicians */
async function technicianHasAccessToWorkOrder(pool, workOrderId, userId) {
  if (!userId || !workOrderId) return false;
  const [legacy] = await pool.query(
    'SELECT 1 FROM work_orders WHERE id = ? AND assigned_technician_id = ? LIMIT 1',
    [workOrderId, userId]
  );
  if (legacy.length > 0) return true;
  const [j] = await pool.query(
    `SELECT 1 FROM work_order_service_technicians wost
     INNER JOIN work_order_services wos ON wost.work_order_service_id = wos.id
     WHERE wos.work_order_id = ? AND wost.technician_id = ? LIMIT 1`,
    [workOrderId, userId]
  );
  return j.length > 0;
}

async function assertTechnicianWorkOrderAccess(pool, workOrderId, user) {
  if (!user || user.role === 'admin') return;
  const ok = await technicianHasAccessToWorkOrder(pool, workOrderId, user.id);
  if (!ok) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }
}

async function validateTechnicianUserIds(pool, ids) {
  const uniq = [...new Set((ids || []).filter((id) => id != null && id !== '').map((id) => parseInt(id, 10)))].filter((n) => !Number.isNaN(n));
  if (uniq.length === 0) return { ok: true, ids: [] };
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE id IN (?) AND role = ? AND is_active = TRUE',
    [uniq, 'technician']
  );
  return { ok: rows.length === uniq.length, ids: uniq };
}

async function syncServiceTechnicians(pool, workOrderServiceId, techniciansPayload) {
  await pool.query('DELETE FROM work_order_service_technicians WHERE work_order_service_id = ?', [workOrderServiceId]);
  const list = Array.isArray(techniciansPayload) ? techniciansPayload : [];
  const seen = new Set();
  for (const t of list) {
    const tid = t.technicianId ?? t.technician_id;
    if (tid == null || tid === '') continue;
    const shift = normalizeShift(t.shift);
    const key = `${tid}:${shift}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await pool.query(
      `INSERT INTO work_order_service_technicians (work_order_service_id, technician_id, shift) VALUES (?, ?, ?)`,
      [workOrderServiceId, parseInt(tid, 10), shift]
    );
  }
}

async function attachTechniciansToOrderServices(pool, orderServices) {
  const wosIds = (orderServices || []).map((s) => s.id).filter(Boolean);
  if (wosIds.length === 0) return;
  try {
    const [techRows] = await pool.query(
      `SELECT wost.work_order_service_id, wost.technician_id, wost.shift, u.full_name AS technician_name
       FROM work_order_service_technicians wost
       JOIN users u ON wost.technician_id = u.id
       WHERE wost.work_order_service_id IN (?)
       ORDER BY u.full_name`,
      [wosIds]
    );
    (orderServices || []).forEach((svc) => {
      if (!svc.id) return;
      svc.technicians = (techRows || [])
        .filter((r) => r.work_order_service_id === svc.id)
        .map((r) => ({
          technician_id: r.technician_id,
          full_name: r.technician_name,
          shift: r.shift
        }));
    });
  } catch (e) {
    console.warn('attachTechniciansToOrderServices:', e.message);
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    if (file.fieldname === 'document') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'documents');
    } else if (file.fieldname === 'superintendent_signature') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'signatures');
    } else {
      uploadPath = path.join(__dirname, '..', 'uploads', 'photos');
    }
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
    } catch (_) {
      /* ignore */
    }
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
        COALESCE(svc_techs.tech_names, u.full_name) as technician_name,
        svc_techs.tech_ids_csv as service_technician_ids,
        creator.full_name as created_by_name
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN equipment_models em ON e.model_id = em.id
      LEFT JOIN equipment_brands eb ON em.brand_id = eb.id
      LEFT JOIN users u ON wo.assigned_technician_id = u.id
      LEFT JOIN users creator ON wo.created_by = creator.id
      LEFT JOIN (
        SELECT wos.work_order_id,
          GROUP_CONCAT(DISTINCT CONCAT(u2.full_name, ' (', IF(wost.shift = 'night', 'Noche/NS', 'Día/DS'), ')') ORDER BY u2.full_name SEPARATOR ', ') AS tech_names,
          GROUP_CONCAT(DISTINCT wost.technician_id ORDER BY wost.technician_id SEPARATOR ',') AS tech_ids_csv
        FROM work_order_service_technicians wost
        INNER JOIN work_order_services wos ON wost.work_order_service_id = wos.id
        INNER JOIN users u2 ON wost.technician_id = u2.id
        GROUP BY wos.work_order_id
      ) svc_techs ON svc_techs.work_order_id = wo.id
    `;
    
    const params = [];
    
    if (req.user.role === 'technician') {
      query += ` WHERE (
        wo.assigned_technician_id = ?
        OR EXISTS (
          SELECT 1 FROM work_order_service_technicians wost2
          INNER JOIN work_order_services wos2 ON wost2.work_order_service_id = wos2.id
          WHERE wos2.work_order_id = wo.id AND wost2.technician_id = ?
        )
      )`;
      params.push(req.user.id, req.user.id);
    }
    
    query += ' ORDER BY wo.created_at DESC';
    
    const [orders] = await pool.query(query, params);
    res.json(orders);
  } catch (error) {
    console.error('Get work orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get work order report PDF (must be before GET /:id)
router.get('/:id/report', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const workOrderId = parseInt(req.params.id, 10);
    if (Number.isNaN(workOrderId)) {
      return res.status(400).json({ error: 'Invalid work order id' });
    }

    const [orders] = await pool.query(`
      SELECT wo.*, st.name as service_type_name, c.name as client_name, c.company_name, c.email as client_email, c.phone as client_phone,
        e.serial_number, e.description as equipment_description,
        CONCAT(eb.name, ' ', em.model_name, ' - ', e.serial_number) as equipment_name,
        em.model_name, em.components as equipment_components, eb.name as brand_name, eb.id as brand_id, em.id as model_id,
        COALESCE(svc_techs.tech_names, u.full_name) as technician_name, u.phone as technician_phone, creator.full_name as created_by_name
      FROM work_orders wo
      LEFT JOIN service_types st ON wo.service_type_id = st.id
      LEFT JOIN clients c ON wo.client_id = c.id
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN equipment_models em ON e.model_id = em.id
      LEFT JOIN equipment_brands eb ON em.brand_id = eb.id
      LEFT JOIN users u ON wo.assigned_technician_id = u.id
      LEFT JOIN users creator ON wo.created_by = creator.id
      LEFT JOIN (
        SELECT wos.work_order_id,
          GROUP_CONCAT(DISTINCT CONCAT(u2.full_name, ' (', IF(wost.shift = 'night', 'Noche/NS', 'Día/DS'), ')') ORDER BY u2.full_name SEPARATOR ', ') AS tech_names
        FROM work_order_service_technicians wost
        INNER JOIN work_order_services wos ON wost.work_order_service_id = wos.id
        INNER JOIN users u2 ON wost.technician_id = u2.id
        GROUP BY wos.work_order_id
      ) svc_techs ON svc_techs.work_order_id = wo.id
      WHERE wo.id = ?
    `, [workOrderId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    const order = orders[0];

    try {
      await assertTechnicianWorkOrderAccess(pool, workOrderId, req.user);
    } catch (e) {
      if (e.statusCode === 403) return res.status(403).json({ error: 'Access denied' });
      throw e;
    }

    const [wosRows] = await pool.query(`
      SELECT wos.id, wos.service_id, wos.housing_count, s.name as service_name, s.code as service_code, s.description as service_description
      FROM work_order_services wos
      LEFT JOIN services s ON wos.service_id = s.id
      WHERE wos.work_order_id = ? ORDER BY wos.id
    `, [workOrderId]);
    let orderServices = wosRows || [];
    await attachTechniciansToOrderServices(pool, orderServices);
    if (orderServices.length === 0 && order.service_id) {
      const [legacy] = await pool.query(
        'SELECT id, name as service_name, code as service_code, description as service_description FROM services WHERE id = ?',
        [order.service_id]
      );
      if (legacy.length > 0) {
        orderServices = [{ service_id: order.service_id, housing_count: order.service_housing_count || 0, ...legacy[0] }];
      }
    }

    const [measurementsRows] = await pool.query(
      'SELECT id, work_order_id, measurement_type, measurement_date, temperature, pressure, voltage, current, resistance, other_measurements, notes, taken_by, created_at FROM measurements WHERE work_order_id = ? ORDER BY measurement_date',
      [workOrderId]
    );
    const measurements = measurementsRows || [];

    const [serviceHousingsRows] = await pool.query(
      'SELECT * FROM work_order_housings WHERE work_order_id = ? ORDER BY work_order_service_id, id',
      [workOrderId]
    );
    const serviceHousings = serviceHousingsRows || [];
    orderServices.forEach((svc, idx) => {
      if (svc.id) {
        svc.housings = serviceHousings.filter((h) => h.work_order_service_id === svc.id);
      } else if (idx === 0) {
        svc.housings = serviceHousings.filter((h) => h.work_order_service_id == null);
      } else {
        svc.housings = [];
      }
    });

    let housingMeasurementsByMeasurementId = new Map();
    try {
      const [hmRows] = await pool.query(`
        SELECT 
          wohm.*,
          woh.measure_code,
          woh.description as housing_description,
          woh.nominal_value,
          woh.nominal_unit,
          woh.tolerance,
          woh.work_order_service_id,
          s.code as service_code,
          s.name as service_name
        FROM work_order_housing_measurements wohm
        JOIN work_order_housings woh ON wohm.housing_id = woh.id
        JOIN measurements m ON wohm.measurement_id = m.id
        LEFT JOIN work_order_services wos ON woh.work_order_service_id = wos.id
        LEFT JOIN services s ON wos.service_id = s.id
        WHERE m.work_order_id = ?
        ORDER BY wos.id, woh.id
      `, [workOrderId]);
      (hmRows || []).forEach((r) => {
        const key = String(r.measurement_id);
        if (!housingMeasurementsByMeasurementId.has(key)) housingMeasurementsByMeasurementId.set(key, []);
        housingMeasurementsByMeasurementId.get(key).push(r);
      });
    } catch (_) {}

    const measurementsWithHousing = measurements.map((m) => {
      const rawType = String(m.measurement_type ?? m.measurementType ?? '').toLowerCase();
      return {
        ...m,
        measurement_type: rawType,
        housing_measurements: housingMeasurementsByMeasurementId.get(String(m.id)) || []
      };
    });

    let photos = [];
    try {
      const [photoRows] = await pool.query(
        `SELECT p.*, wos.service_id AS photo_service_id, s.name AS photo_service_name, s.code AS photo_service_code
         FROM work_order_photos p
         LEFT JOIN work_order_services wos ON p.work_order_service_id = wos.id
         LEFT JOIN services s ON wos.service_id = s.id
         WHERE p.work_order_id = ? ORDER BY p.created_at`,
        [workOrderId]
      );
      photos = photoRows || [];
    } catch (_) {
      const [fb] = await pool.query('SELECT * FROM work_order_photos WHERE work_order_id = ? ORDER BY created_at', [workOrderId]);
      photos = fb || [];
    }

    let conformityCapataz = null;
    let conformitySuperintendente = null;
    try {
      const [sigRows] = await pool.query(
        'SELECT id, signature_role, signature_data, signed_by_name, signed_at FROM work_order_conformity_signatures WHERE work_order_id = ?',
        [workOrderId]
      );
      sigRows.forEach((r) => {
        const role = (r.signature_role || '').toLowerCase();
        if (role === 'superintendente') conformitySuperintendente = r;
        else conformityCapataz = r;
      });
    } catch (_) {}

    let documents = [];
    try {
      const [docResults] = await pool.query(`
        SELECT wod.*, ed.brand_id as equipment_brand_id, ed.model_id as equipment_model_id, ed.housing_id as equipment_housing_id,
          CASE WHEN wodp.id IS NOT NULL THEN wodp.is_visible_to_technician ELSE TRUE END as is_visible_to_technician
        FROM work_order_documents wod
        LEFT JOIN equipment_documents ed ON wod.equipment_document_id = ed.id
        LEFT JOIN work_order_document_permissions wodp ON wod.id = wodp.document_id AND wodp.work_order_id = ?
        WHERE wod.work_order_id = ? OR wod.equipment_id = ?
        ORDER BY wod.created_at
      `, [workOrderId, workOrderId, order.equipment_id]);
      documents = docResults || [];
    } catch (_) {}

    if (order.equipment_id) {
      const [equipDetails] = await pool.query(
        'SELECT e.housing_id, em.brand_id, em.id as model_id FROM equipment e JOIN equipment_models em ON e.model_id = em.id WHERE e.id = ?',
        [order.equipment_id]
      );
      if (equipDetails.length > 0) {
        const eq = equipDetails[0];
        const [equipDocs] = await pool.query(`
          SELECT ed.*, CASE WHEN wodp.id IS NOT NULL THEN wodp.is_visible_to_technician ELSE TRUE END as is_visible_to_technician
          FROM equipment_documents ed
          LEFT JOIN work_order_documents wod ON wod.equipment_document_id = ed.id AND wod.work_order_id = ?
          LEFT JOIN work_order_document_permissions wodp ON wod.id = wodp.document_id AND wodp.work_order_id = ?
          WHERE (ed.brand_id = ? OR ed.model_id = ? OR ed.housing_id = ?) AND wod.id IS NULL
        `, [workOrderId, workOrderId, eq.brand_id, eq.model_id, eq.housing_id || -1]);
        const existingDocIds = new Set(documents.map(d => d.equipment_document_id).filter(Boolean));
        (equipDocs || []).forEach(ed => {
          if (!existingDocIds.has(ed.id)) {
            documents.push({ ...ed, id: `equip_${ed.id}`, is_equipment_document: true });
          }
        });
      }
    }

    const payload = {
      ...order,
      services: orderServices,
      service_housings: serviceHousings,
      measurements: measurementsWithHousing,
      photos: photos || [],
      documents: documents || [],
      conformity_signature_capataz: conformityCapataz,
      conformity_signature_superintendente: conformitySuperintendente
    };

    const { generateWorkOrderReport } = await import('../lib/pdfReport.js');
    const pdfBuffer = await generateWorkOrderReport(payload);
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
      console.error('Work order report: invalid buffer');
      return res.status(500).json({ error: 'Error al generar el reporte PDF' });
    }
    const filename = `OT-${(order.order_number || order.id).toString().replace(/\s/g, '-')}-reporte.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Work order report error:', error?.message || error);
    if (error?.stack) console.error(error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar el reporte PDF' });
    }
  }
});

/**
 * Descargar/ver documento de la OT con JWT (evita abrir /api/uploads en nueva pestaña:
 * la PWA suele interceptar esa navegación y devolver index.html → Dashboard).
 */
router.get('/:id/documents/:documentId/file', authenticateToken, async (req, res) => {
  try {
    const workOrderId = parseInt(req.params.id, 10);
    const documentIdRaw = decodeURIComponent(String(req.params.documentId || ''));
    if (Number.isNaN(workOrderId)) {
      return res.status(400).json({ error: 'ID de orden inválido' });
    }

    const pool = await getConnection();
    const [orders] = await pool.query(
      'SELECT id, equipment_id, assigned_technician_id FROM work_orders WHERE id = ?',
      [workOrderId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    const wo = orders[0];

    if (req.user.role === 'technician') {
      const ok = await technicianHasAccessToWorkOrder(pool, workOrderId, req.user.id);
      if (!ok) return res.status(403).json({ error: 'Acceso denegado' });
    }

    const isVisibleToTechnician = (v) => {
      if (v === undefined || v === null) return true;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
      return Boolean(v);
    };

    let filePath = null;
    let fileName = 'documento';
    let mimeType = 'application/octet-stream';
    let visible = true;

    const equipMatch = documentIdRaw.match(/^equip_(\d+)$/);

    if (equipMatch) {
      const edId = parseInt(equipMatch[1], 10);
      if (Number.isNaN(edId) || !wo.equipment_id) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }
      const [equipDetails] = await pool.query(
        `SELECT e.housing_id, em.brand_id, em.id as model_id
         FROM equipment e
         JOIN equipment_models em ON e.model_id = em.id
         WHERE e.id = ?`,
        [wo.equipment_id]
      );
      if (equipDetails.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }
      const eq = equipDetails[0];
      const [edRows] = await pool.query(
        `SELECT ed.file_path, ed.file_name, ed.mime_type
         FROM equipment_documents ed
         LEFT JOIN work_order_documents wod ON wod.equipment_document_id = ed.id AND wod.work_order_id = ?
         WHERE ed.id = ?
           AND (ed.brand_id = ? OR ed.model_id = ? OR ed.housing_id = ?)
           AND wod.id IS NULL`,
        [workOrderId, edId, eq.brand_id, eq.model_id, eq.housing_id || -1]
      );
      if (edRows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }
      const row = edRows[0];
      filePath = row.file_path;
      fileName = row.file_name || fileName;
      mimeType = row.mime_type || mimeType;
      visible = true;
    } else {
      const wodId = parseInt(documentIdRaw, 10);
      if (Number.isNaN(wodId)) {
        return res.status(400).json({ error: 'ID de documento inválido' });
      }
      const [wodRows] = await pool.query(
        `SELECT wod.file_path, wod.file_name, wod.mime_type,
          CASE WHEN wodp.id IS NOT NULL THEN wodp.is_visible_to_technician ELSE TRUE END as is_visible_to_technician
         FROM work_order_documents wod
         LEFT JOIN work_order_document_permissions wodp ON wod.id = wodp.document_id AND wodp.work_order_id = ?
         WHERE wod.id = ? AND (wod.work_order_id = ? OR wod.equipment_id = ?)`,
        [workOrderId, wodId, workOrderId, wo.equipment_id]
      );
      if (wodRows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }
      const row = wodRows[0];
      filePath = row.file_path;
      fileName = row.file_name || fileName;
      mimeType = row.mime_type || mimeType;
      visible = isVisibleToTechnician(row.is_visible_to_technician);
    }

    if (req.user.role === 'technician' && !visible) {
      return res.status(403).json({ error: 'Documento no disponible para el técnico' });
    }

    const baseName = path.basename(String(filePath || '').replace(/^\/+/, ''));
    if (!baseName || baseName.includes('..')) {
      return res.status(400).json({ error: 'Ruta inválida' });
    }
    const absPath = path.join(__dirname, '..', 'uploads', 'documents', baseName);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    res.setHeader('Content-Type', mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    console.error('Work order document file error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al obtener el documento' });
    }
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
        loc.name as location_name,
        st.name as service_type_name,
        COALESCE(svc_techs.tech_names, u.full_name) as technician_name,
        u.phone as technician_phone,
        creator.full_name as created_by_name
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN equipment_models em ON e.model_id = em.id
      LEFT JOIN equipment_brands eb ON em.brand_id = eb.id
      LEFT JOIN locations loc ON wo.location_id = loc.id
      LEFT JOIN service_types st ON wo.service_type_id = st.id
      LEFT JOIN users u ON wo.assigned_technician_id = u.id
      LEFT JOIN users creator ON wo.created_by = creator.id
      LEFT JOIN (
        SELECT wos.work_order_id,
          GROUP_CONCAT(DISTINCT CONCAT(u2.full_name, ' (', IF(wost.shift = 'night', 'Noche/NS', 'Día/DS'), ')') ORDER BY u2.full_name SEPARATOR ', ') AS tech_names
        FROM work_order_service_technicians wost
        INNER JOIN work_order_services wos ON wost.work_order_service_id = wos.id
        INNER JOIN users u2 ON wost.technician_id = u2.id
        GROUP BY wos.work_order_id
      ) svc_techs ON svc_techs.work_order_id = wo.id
      WHERE wo.id = ?
    `, [req.params.id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    const order = orders[0];

    try {
      await assertTechnicianWorkOrderAccess(pool, parseInt(req.params.id, 10), req.user);
    } catch (e) {
      if (e.statusCode === 403) return res.status(403).json({ error: 'Access denied' });
      throw e;
    }

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
      await attachTechniciansToOrderServices(pool, orderServices);
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
    
    // Get measurements (initial and final) — ensure work_order_id is integer for consistent query
    const workOrderId = parseInt(req.params.id, 10);
    const [measurementsRows] = await pool.query(
      'SELECT id, work_order_id, measurement_type, measurement_date, temperature, pressure, voltage, current, resistance, other_measurements, notes, taken_by, created_at FROM measurements WHERE work_order_id = ? ORDER BY measurement_date',
      [workOrderId]
    );
    const measurements = measurementsRows || [];

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
          woh.tolerance,
          woh.work_order_service_id,
          s.code as service_code,
          s.name as service_name
        FROM work_order_housing_measurements wohm
        JOIN work_order_housings woh ON wohm.housing_id = woh.id
        JOIN measurements m ON wohm.measurement_id = m.id
        LEFT JOIN work_order_services wos ON woh.work_order_service_id = wos.id
        LEFT JOIN services s ON wos.service_id = s.id
        WHERE m.work_order_id = ?
        ORDER BY wos.id, woh.id
      `, [workOrderId]);

      (rows || []).forEach((r) => {
        const key = String(r.measurement_id);
        if (!housingMeasurementsByMeasurementId.has(key)) {
          housingMeasurementsByMeasurementId.set(key, []);
        }
        housingMeasurementsByMeasurementId.get(key).push(r);
      });
    } catch (error) {
      console.error('Error fetching housing measurements:', error);
      housingMeasurementsByMeasurementId = new Map();
    }

    // Build measurements with housing_measurements; ensure measurement_type is always lowercase for frontend
    const measurementsWithHousing = measurements.map((m) => {
      const rawType = String(m.measurement_type ?? m.measurementType ?? '').toLowerCase();
      return {
        id: m.id,
        work_order_id: m.work_order_id,
        measurement_type: rawType,
        measurement_date: m.measurement_date,
        temperature: m.temperature,
        pressure: m.pressure,
        voltage: m.voltage,
        current: m.current,
        resistance: m.resistance,
        other_measurements: m.other_measurements,
        notes: m.notes,
        taken_by: m.taken_by,
        created_at: m.created_at,
        housing_measurements: housingMeasurementsByMeasurementId.get(String(m.id)) || []
      };
    });
    
    // Get photos (con servicio asociado si existe)
    let photos = [];
    try {
      const [photoRows] = await pool.query(
        `SELECT p.*, wos.service_id AS photo_service_id, s.name AS photo_service_name, s.code AS photo_service_code
         FROM work_order_photos p
         LEFT JOIN work_order_services wos ON p.work_order_service_id = wos.id
         LEFT JOIN services s ON wos.service_id = s.id
         WHERE p.work_order_id = ? ORDER BY p.created_at`,
        [req.params.id]
      );
      photos = photoRows || [];
    } catch (pe) {
      const [fallback] = await pool.query(
        'SELECT * FROM work_order_photos WHERE work_order_id = ? ORDER BY created_at',
        [req.params.id]
      );
      photos = fallback || [];
    }
    
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

    let conformityCapataz = null;
    let conformitySuperintendente = null;
    try {
      const [sigRows] = await pool.query(
        'SELECT id, signature_role, signed_by_name, signed_at FROM work_order_conformity_signatures WHERE work_order_id = ?',
        [req.params.id]
      );
      sigRows.forEach((r) => {
        const role = (r.signature_role || '').toLowerCase();
        if (role === 'superintendente') conformitySuperintendente = r;
        else conformityCapataz = r;
      });
    } catch (e) { /* ignore */ }

    res.json({
      ...order,
      services: orderServices,
      service_housings: serviceHousings,
      measurements: Array.isArray(measurementsWithHousing) ? measurementsWithHousing : [],
      photos: photos || [],
      observations: observations || [],
      documents: documents || [],
      conformity_signature_capataz: conformityCapataz,
      conformity_signature_superintendente: conformitySuperintendente,
      conformity_signature: conformityCapataz || conformitySuperintendente
    });
  } catch (error) {
    console.error('Get work order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create work order
router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'work_order'), async (req, res) => {
  try {
    const { clientId, equipmentId, services, serviceLocation, locationId, serviceTypeId, clientServiceOrderNumber, title, description, priority, scheduledDate } = req.body;
    
    if (!clientId || !equipmentId || !title) {
      return res.status(400).json({ error: 'Client, equipment, and title are required' });
    }

    // services: [{ serviceId, housingCount, housings, technicians: [{ technicianId, shift }] }]
    let servicesList = Array.isArray(services) && services.length > 0
      ? services.filter(s => s.serviceId)
      : [];

    const pool = await getConnection();

    if (servicesList.length > 0) {
      const allTechIds = [];
      for (const s of servicesList) {
        const techList = Array.isArray(s.technicians) ? s.technicians : [];
        const ids = techList.map((t) => t.technicianId ?? t.technician_id).filter((x) => x !== '' && x != null);
        if (ids.length === 0) {
          return res.status(400).json({
            error: 'Cada servicio debe tener al menos un técnico asignado (turno Día/DS o Noche/NS).'
          });
        }
        allTechIds.push(...ids.map((x) => parseInt(x, 10)));
      }
      const v = await validateTechnicianUserIds(pool, allTechIds);
      if (!v.ok) {
        return res.status(400).json({ error: 'Uno o más técnicos no son válidos o no están activos.' });
      }
    }

    // Resolve service_location: use location name when locationId is set, else use provided text
    let resolvedServiceLocation = serviceLocation || null;
    const locId = locationId !== undefined && locationId !== null && locationId !== '' ? parseInt(locationId, 10) : null;
    const stId = serviceTypeId !== undefined && serviceTypeId !== null && serviceTypeId !== '' ? parseInt(serviceTypeId, 10) : null;
    if (locId) {
      const [locRows] = await pool.query('SELECT name FROM locations WHERE id = ?', [locId]);
      if (locRows.length > 0) resolvedServiceLocation = locRows[0].name;
    }

    let housingsAllowedForMachining = false;
    if (stId) {
      const [stRows] = await pool.query('SELECT name FROM service_types WHERE id = ?', [stId]);
      if (stRows.length > 0) housingsAllowedForMachining = isMachiningRepairTypeName(stRows[0].name);
    }
    if (!housingsAllowedForMachining) {
      servicesList = servicesList.map((s) => ({ ...s, housingCount: 0, housings: [] }));
    }

    const totalHousingCount = servicesList.reduce((sum, s) => sum + (Array.isArray(s.housings) ? s.housings.length : 0), 0);

    const hasServiceTechs = servicesList.some(
      (s) => Array.isArray(s.technicians) && s.technicians.some((t) => t.technicianId ?? t.technician_id)
    );
    const initialStatus = hasServiceTechs ? 'assigned' : 'created';

    // Generate order number
    const [count] = await pool.query('SELECT COUNT(*) as count FROM work_orders');
    const nextNum = Number(count[0]?.count ?? 0) + 1;
    const orderNumber = `OT-${String(nextNum).padStart(6, '0')}`;
    
    const woValues = [
      orderNumber,
      clientId,
      equipmentId,
      stId,
      locId,
      resolvedServiceLocation,
      clientServiceOrderNumber || null,
      totalHousingCount,
      null,
      title,
      description || null,
      priority || 'medium',
      scheduledDate || null,
      req.user.id,
      initialStatus
    ];
    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO work_orders 
         (order_number, client_id, equipment_id, service_type_id, location_id, service_location, client_service_order_number, service_housing_count, assigned_technician_id, title, description, priority, scheduled_date, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        woValues
      );
    } catch (woErr) {
      if (woErr.code === 'ER_BAD_FIELD_ERROR' && woErr.sqlMessage && (woErr.sqlMessage.includes('service_type_id') || woErr.sqlMessage.includes('location_id'))) {
        const legacyValues = [orderNumber, clientId, equipmentId, resolvedServiceLocation, clientServiceOrderNumber || null, totalHousingCount, null, title, description || null, priority || 'medium', scheduledDate || null, req.user.id, initialStatus];
        [result] = await pool.query(
          `INSERT INTO work_orders 
           (order_number, client_id, equipment_id, service_location, client_service_order_number, service_housing_count, assigned_technician_id, title, description, priority, scheduled_date, created_by, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          legacyValues
        );
      } else if (woErr.code === 'ER_BAD_FIELD_ERROR' && woErr.sqlMessage && woErr.sqlMessage.includes('client_service_order_number')) {
        [result] = await pool.query(
          `INSERT INTO work_orders 
           (order_number, client_id, equipment_id, service_type_id, location_id, service_location, service_housing_count, assigned_technician_id, title, description, priority, scheduled_date, created_by, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderNumber, clientId, equipmentId, stId, locId, resolvedServiceLocation, totalHousingCount, null, title, description || null, priority || 'medium', scheduledDate || null, req.user.id, initialStatus]
        );
      } else {
        throw woErr;
      }
    }

    // Insert work_order_services y housings por cada servicio
    if (servicesList.length > 0) {
      for (const s of servicesList) {
        const housingCount = Number(s.housingCount) || 0;
        const [wosRes] = await pool.query(
          'INSERT INTO work_order_services (work_order_id, service_id, housing_count) VALUES (?, ?, ?)',
          [result.insertId, s.serviceId, housingCount]
        );
        const wosId = wosRes.insertId;
        try {
          await syncServiceTechnicians(pool, wosId, s.technicians);
        } catch (syncErr) {
          console.error('syncServiceTechnicians (create):', syncErr);
          return res.status(500).json({ error: 'No se pudo guardar la asignación de técnicos por servicio.' });
        }
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
    const { title, description, priority, scheduledDate, assignedTechnicianId, status, serviceLocation, locationId, serviceTypeId, services, clientServiceOrderNumber, equipmentId, startDate, completionDate } = req.body;
    const pool = await getConnection();
    
    // Check permissions
    const [orders] = await pool.query('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    const order = orders[0];
    
    // Technicians can only update status and start/completion dates
    if (req.user.role === 'technician') {
      try {
        await assertTechnicianWorkOrderAccess(pool, parseInt(req.params.id, 10), req.user);
      } catch (e) {
        if (e.statusCode === 403) return res.status(403).json({ error: 'Access denied' });
        throw e;
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

      let effStartT = order.start_date;
      let effCompletionT = order.completion_date;
      if (status !== undefined) {
        if (status === 'in_progress' && !order.start_date) {
          effStartT = new Date();
        }
        if (status === 'completed' && !order.completion_date) {
          effCompletionT = new Date();
        }
      }
      const techDateErr = completionBeforeStartError(effStartT, effCompletionT);
      if (techDateErr) {
        return res.status(400).json({ error: techDateErr });
      }
      
      updateValues.push(req.params.id);
      await pool.query(`UPDATE work_orders SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
      const statusDesc = { in_progress: 'Orden puesta en proceso', completed: 'Orden completada', accepted: 'Orden aceptada', on_hold: 'Orden puesta en espera', cancelled: 'Orden cancelada' };
      const desc = statusDesc[status] || `Estado actualizado a ${status}`;
      await logActivity(req.user.id, 'UPDATE', 'work_order', req.params.id, desc, req.ip);
      return res.json({ message: 'Work order updated successfully' });
    }
    
    // Admin: órdenes cerradas solo editables por administrador (título, servicios, fechas, etc.)
    const closedOrderStatuses = new Set(['completed', 'accepted', 'cancelled']);
    if (closedOrderStatuses.has(order.status) && req.user.role !== 'admin') {
      return res.status(403).json({
        error:
          'Solo un administrador puede modificar órdenes completadas, aceptadas o canceladas.',
      });
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
    // No reemplazar servicios/alojamientos si ya hay mediciones tomadas (evitar perder work_order_housing_measurements)
    if (services !== undefined && Array.isArray(services)) {
      let effTypeIdForHousings =
        serviceTypeId !== undefined
          ? (serviceTypeId !== null && serviceTypeId !== '' ? parseInt(serviceTypeId, 10) : null)
          : (order.service_type_id != null ? Number(order.service_type_id) : null);
      let housingsAllowedForMachining = false;
      if (effTypeIdForHousings) {
        const [stRows] = await pool.query('SELECT name FROM service_types WHERE id = ?', [effTypeIdForHousings]);
        if (stRows.length > 0) housingsAllowedForMachining = isMachiningRepairTypeName(stRows[0].name);
      }
      const normalizeServicesPayload = (list) =>
        housingsAllowedForMachining
          ? list
          : list.map((s) => ({ ...s, housingCount: 0, housings: [] }));

      const servicesListNormalized = normalizeServicesPayload(services.filter((s) => s && s.serviceId));
      if (servicesListNormalized.length > 0) {
        const allTechIds = [];
        for (const s of servicesListNormalized) {
          const techList = Array.isArray(s.technicians) ? s.technicians : [];
          const ids = techList.map((t) => t.technicianId ?? t.technician_id).filter((x) => x !== '' && x != null);
          if (ids.length === 0) {
            return res.status(400).json({
              error: 'Cada servicio debe tener al menos un técnico asignado (turno Día/DS o Noche/NS).'
            });
          }
          allTechIds.push(...ids.map((x) => parseInt(x, 10)));
        }
        const v = await validateTechnicianUserIds(pool, allTechIds);
        if (!v.ok) {
          return res.status(400).json({ error: 'Uno o más técnicos no son válidos o no están activos.' });
        }
      }

      const [measCount] = await pool.query('SELECT COUNT(*) AS c FROM measurements WHERE work_order_id = ?', [req.params.id]);
      if ((measCount[0]?.c || 0) > 0) {
        // Hay mediciones: no borrar filas (FK desde work_order_housing_measurements).
        // - Servicios ya existentes: actualizar housing_count y alojamientos por (work_order_service_id + measure_code).
        // - Servicios nuevos en el payload: INSERT work_order_services + work_order_housings (sin mediciones aún).
        const [existingWos] = await pool.query(
          'SELECT id, service_id, housing_count FROM work_order_services WHERE work_order_id = ?',
          [req.params.id]
        );
        const wosByServiceId = new Map(existingWos.map((r) => [Number(r.service_id), r]));

        const servicesList = servicesListNormalized;
        for (const s of servicesList) {
          const sid = Number(s.serviceId);
          const housingCount = Number(s.housingCount) || 0;
          const housings = Array.isArray(s.housings) ? s.housings : [];

          let wosId;
          const existingRow = wosByServiceId.get(sid);
          if (existingRow) {
            wosId = existingRow.id;
            await pool.query('UPDATE work_order_services SET housing_count = ? WHERE id = ?', [housingCount, wosId]);
          } else {
            const [ins] = await pool.query(
              'INSERT INTO work_order_services (work_order_id, service_id, housing_count) VALUES (?, ?, ?)',
              [req.params.id, sid, housingCount]
            );
            wosId = ins.insertId;
          }

          await syncServiceTechnicians(pool, wosId, s.technicians);

          for (const h of housings) {
            const code = (h.measureCode || h.measure_code || '').toString().trim();
            if (!code) continue;
            const nomVal =
              h.nominalValue !== undefined && h.nominalValue !== null && h.nominalValue !== '' ? h.nominalValue : null;
            const nomUnit = h.unit || h.nominalUnit || h.nominal_unit || null;
            const tol = h.tolerance || null;
            const desc = h.description || null;

            const [whRows] = await pool.query(
              'SELECT id FROM work_order_housings WHERE work_order_id = ? AND work_order_service_id = ? AND measure_code = ?',
              [req.params.id, wosId, code]
            );
            if (whRows.length > 0) {
              await pool.query(
                `UPDATE work_order_housings SET nominal_value = ?, nominal_unit = ?, tolerance = ?, description = ? WHERE id = ?`,
                [nomVal, nomUnit, tol, desc, whRows[0].id]
              );
            } else {
              await pool.query(
                `INSERT INTO work_order_housings (work_order_id, work_order_service_id, measure_code, description, nominal_value, nominal_unit, tolerance)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.params.id, wosId, code, desc, nomVal, nomUnit, tol]
              );
            }
          }

          // Sin filas de alojamiento en el payload pero count > 0: payload incompleto (p. ej. solo se añadió otro servicio).
          // NO eliminar alojamientos en BD: ON DELETE CASCADE en work_order_housing_measurements borraría las medidas.
          if (housings.length === 0 && housingCount > 0) {
            continue;
          }

          const payloadCodes = new Set(
            housings
              .map((h) => (h.measureCode || h.measure_code || '').toString().trim())
              .filter(Boolean)
          );
          const [dbHousingRows] = await pool.query(
            'SELECT id, measure_code FROM work_order_housings WHERE work_order_id = ? AND work_order_service_id = ?',
            [req.params.id, wosId]
          );
          for (const dbH of dbHousingRows || []) {
            const code = (dbH.measure_code || '').toString().trim();
            if (!code || payloadCodes.has(code)) continue;
            const [mref] = await pool.query(
              'SELECT COUNT(*) AS c FROM work_order_housing_measurements WHERE housing_id = ?',
              [dbH.id]
            );
            if ((mref[0]?.c || 0) > 0) {
              return res.status(400).json({
                error:
                  `No se puede eliminar el alojamiento «${code}»: tiene mediciones registradas. Quite esas filas al editar la medición antes de eliminar el alojamiento.`,
              });
            }
            await pool.query('DELETE FROM work_order_housings WHERE id = ? AND work_order_id = ?', [dbH.id, req.params.id]);
          }
        }

        // Quitar de la OT los servicios que el admin eliminó del payload (si no tienen mediciones en sus alojamientos).
        const payloadServiceIdSet = new Set(servicesList.map((s) => Number(s.serviceId)));
        const [wosStillInDb] = await pool.query(
          'SELECT id, service_id FROM work_order_services WHERE work_order_id = ?',
          [req.params.id]
        );
        for (const row of wosStillInDb) {
          if (payloadServiceIdSet.has(Number(row.service_id))) continue;
          const [cntRows] = await pool.query(
            `SELECT COUNT(*) AS c FROM work_order_housing_measurements whm
             INNER JOIN work_order_housings wh ON wh.id = whm.housing_id
             WHERE wh.work_order_service_id = ?`,
            [row.id]
          );
          if ((cntRows[0]?.c || 0) > 0) {
            return res.status(400).json({
              error:
                'No se puede quitar un servicio que ya tiene mediciones registradas en sus alojamientos. Elimine o ajuste esas mediciones antes de quitar el servicio.'
            });
          }
          await pool.query('DELETE FROM work_order_services WHERE id = ? AND work_order_id = ?', [row.id, req.params.id]);
        }

        if (updateFields.length === 0) {
          updateFields.push('updated_at = NOW()');
        }
      } else {
        await pool.query('DELETE FROM work_order_services WHERE work_order_id = ?', [req.params.id]);
        const servicesList = servicesListNormalized;
        for (const s of servicesList) {
          const housingCount = Number(s.housingCount) || 0;
          const [wosRes] = await pool.query(
            'INSERT INTO work_order_services (work_order_id, service_id, housing_count) VALUES (?, ?, ?)',
            [req.params.id, s.serviceId, housingCount]
          );
          await syncServiceTechnicians(pool, wosRes.insertId, s.technicians);
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
            if (values.every((v) => v[2])) {
              await pool.query(
                `INSERT INTO work_order_housings (work_order_id, work_order_service_id, measure_code, description, nominal_value, nominal_unit, tolerance)
                 VALUES ?`,
                [values]
              );
            }
          }
        }
      }

      const [[sumRow]] = await pool.query(
        'SELECT COALESCE(SUM(housing_count), 0) AS t FROM work_order_services WHERE work_order_id = ?',
        [req.params.id]
      );
      await pool.query('UPDATE work_orders SET service_housing_count = ? WHERE id = ?', [sumRow.t, req.params.id]);
      try {
        await linkNewHousingsToInitialMeasurement(pool, parseInt(req.params.id, 10));
      } catch (linkErr) {
        console.error('linkNewHousingsToInitialMeasurement:', linkErr?.message || linkErr);
      }
      // Sin mediciones: el bloque anterior no añade columnas a updateFields; asegurar un UPDATE mínimo.
      if (updateFields.length === 0) {
        updateFields.push('updated_at = NOW()');
      }
    }
    if (locationId !== undefined) {
      const locId = locationId !== null && locationId !== '' ? parseInt(locationId, 10) : null;
      updateFields.push('location_id = ?');
      updateValues.push(locId);
      if (locId) {
        const [locRows] = await pool.query('SELECT name FROM locations WHERE id = ?', [locId]);
        if (locRows.length > 0) {
          updateFields.push('service_location = ?');
          updateValues.push(locRows[0].name);
        }
      } else {
        updateFields.push('service_location = ?');
        updateValues.push(null);
      }
    }
    if (serviceTypeId !== undefined) {
      const stId = serviceTypeId !== null && serviceTypeId !== '' ? parseInt(serviceTypeId, 10) : null;
      updateFields.push('service_type_id = ?');
      updateValues.push(stId);
    }
    if (serviceLocation !== undefined && locationId === undefined) {
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
    if (startDate !== undefined) {
      let startVal = null;
      if (startDate) {
        const s = startDate.replace('T', ' ');
        startVal = s.length === 16 ? `${s}:00` : s;
      }
      updateFields.push('start_date = ?');
      updateValues.push(startVal);
    }
    if (completionDate !== undefined) {
      let endVal = null;
      if (completionDate) {
        const s = completionDate.replace('T', ' ');
        endVal = s.length === 16 ? `${s}:00` : s;
      }
      updateFields.push('completion_date = ?');
      updateValues.push(endVal);
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

    const { effStart, effCompletion } = getEffectiveStartCompletionAfterPut(order, {
      startDate,
      completionDate,
      status
    });
    const dateOrderErr = completionBeforeStartError(effStart, effCompletion);
    if (dateOrderErr) {
      return res.status(400).json({ error: dateOrderErr });
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
    
    if (req.user.role === 'technician') {
      const ok = await technicianHasAccessToWorkOrder(pool, parseInt(req.params.id, 10), req.user.id);
      if (!ok) return res.status(403).json({ error: 'Access denied' });
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

// Update measurement (notes and housing values) — solo administradores; técnicos no pueden modificar mediciones ya registradas
router.put('/:id/measurements/:measurementId', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { notes, housingMeasurements } = req.body;
    const workOrderId = req.params.id;
    const measurementId = req.params.measurementId;
    const pool = await getConnection();

    const [measRows] = await pool.query(
      'SELECT id FROM measurements WHERE id = ? AND work_order_id = ?',
      [measurementId, workOrderId]
    );
    if (measRows.length === 0) {
      return res.status(404).json({ error: 'Medición no encontrada' });
    }

    if (notes !== undefined) {
      await pool.query('UPDATE measurements SET notes = ? WHERE id = ?', [notes ?? null, measurementId]);
    }

    if (Array.isArray(housingMeasurements)) {
      await pool.query('DELETE FROM work_order_housing_measurements WHERE measurement_id = ?', [measurementId]);
      if (housingMeasurements.length > 0) {
        const housingIds = [...new Set(housingMeasurements.map(hm => hm.housingId || hm.housing_id).filter(Boolean))];
        if (housingIds.length > 0) {
          const [existing] = await pool.query(
            'SELECT id FROM work_order_housings WHERE work_order_id = ? AND id IN (?)',
            [workOrderId, housingIds]
          );
          const existingSet = new Set(existing.map(r => r.id));
          const invalid = housingIds.filter(id => !existingSet.has(id));
          if (invalid.length > 0) {
            return res.status(400).json({ error: 'Alojamientos inválidos para esta orden' });
          }
        }
        const values = housingMeasurements.map((hm) => ([
          measurementId,
          hm.housingId || hm.housing_id,
          hm.x1 !== undefined && hm.x1 !== null && hm.x1 !== '' ? hm.x1 : null,
          hm.y1 !== undefined && hm.y1 !== null && hm.y1 !== '' ? hm.y1 : null,
          hm.unit || null
        ]));
        await pool.query(
          `INSERT INTO work_order_housing_measurements (measurement_id, housing_id, x1, y1, unit) VALUES ?`,
          [values]
        );
      }
    }

    await logActivity(req.user.id, 'UPDATE', 'measurement', measurementId, 'Medición actualizada', req.ip);
    res.json({ message: 'Medición actualizada correctamente' });
  } catch (error) {
    console.error('Update measurement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload photo
router.post('/:id/photos', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }
    
    const { photoType, description, workOrderServiceId } = req.body;
    const pool = await getConnection();
    const woIdInt = parseInt(req.params.id, 10);
    
    // Check permissions
    const [orders] = await pool.query('SELECT id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    if (req.user.role === 'technician') {
      const ok = await technicianHasAccessToWorkOrder(pool, woIdInt, req.user.id);
      if (!ok) return res.status(403).json({ error: 'Access denied' });
    }

    const [svcCountRows] = await pool.query(
      'SELECT COUNT(*) AS c FROM work_order_services WHERE work_order_id = ?',
      [woIdInt]
    );
    const svcCount = svcCountRows[0]?.c || 0;
    const rawWos = workOrderServiceId ?? req.body.work_order_service_id;
    let wosIdVal = null;
    if (rawWos !== undefined && rawWos !== null && String(rawWos).trim() !== '') {
      const wosParsed = parseInt(String(rawWos), 10);
      const [wosRows] = await pool.query(
        'SELECT id FROM work_order_services WHERE id = ? AND work_order_id = ?',
        [wosParsed, woIdInt]
      );
      if (wosRows.length === 0) {
        return res.status(400).json({ error: 'El servicio seleccionado no pertenece a esta orden.' });
      }
      wosIdVal = wosParsed;
    }
    if (svcCount > 1 && wosIdVal == null) {
      return res.status(400).json({ error: 'Seleccione el servicio al que corresponde la foto.' });
    }
    if (svcCount === 1 && wosIdVal == null) {
      const [one] = await pool.query(
        'SELECT id FROM work_order_services WHERE work_order_id = ? ORDER BY id LIMIT 1',
        [woIdInt]
      );
      if (one.length > 0) wosIdVal = one[0].id;
    }
    
    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO work_order_photos (work_order_id, work_order_service_id, photo_path, photo_type, description, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          wosIdVal,
          `/uploads/photos/${req.file.filename}`,
          photoType || 'during_service',
          description || null,
          req.user.id
        ]
      );
    } catch (insErr) {
      if (insErr.code === 'ER_BAD_FIELD_ERROR' && insErr.sqlMessage && insErr.sqlMessage.includes('work_order_service_id')) {
        [result] = await pool.query(
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
      } else {
        throw insErr;
      }
    }
    
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
    if (req.user.role === 'technician') {
      const ok = await technicianHasAccessToWorkOrder(pool, parseInt(req.params.id, 10), req.user.id);
      if (!ok) return res.status(403).json({ error: 'Access denied' });
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
    
    if (req.user.role === 'technician') {
      const ok = await technicianHasAccessToWorkOrder(pool, parseInt(req.params.id, 10), req.user.id);
      if (!ok) return res.status(403).json({ error: 'Access denied' });
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
    if (req.user.role === 'technician') {
      const ok = await technicianHasAccessToWorkOrder(pool, parseInt(req.params.id, 10), req.user.id);
      if (!ok) return res.status(403).json({ error: 'Access denied' });
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

// Imagen de firma del superintendente (solo admin; adjunta por correo u otro medio)
router.post('/:id/superintendent-signature', authenticateToken, requireRole('admin'), upload.single('superintendent_signature'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Seleccione un archivo de imagen' });
    }
    const signedBy = (req.body.signedBy && String(req.body.signedBy).trim()) || null;
    const pool = await getConnection();
    const [orders] = await pool.query('SELECT id, superintendent_signature_path FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Work order not found' });
    const oldPath = orders[0].superintendent_signature_path;
    const newRel = `/uploads/signatures/${req.file.filename}`;
    await pool.query(
      `UPDATE work_orders SET superintendent_signature_path = ?, superintendent_signature_signed_by = ?, superintendent_signature_signed_at = NOW() WHERE id = ?`,
      [newRel, signedBy, req.params.id]
    );
    if (oldPath) {
      try {
        const oldName = path.basename(String(oldPath).replace(/^\/+/, ''));
        if (oldName) fs.unlinkSync(path.join(__dirname, '..', 'uploads', 'signatures', oldName));
      } catch (_) {
        /* ignore */
      }
    }
    await logActivity(req.user.id, 'UPDATE', 'work_order', req.params.id, 'Firma del superintendente adjuntada', req.ip);
    res.json({ message: 'Firma del superintendente guardada', filePath: newRel });
  } catch (error) {
    console.error('Superintendent signature upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/superintendent-signature', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const pool = await getConnection();
    const [orders] = await pool.query('SELECT superintendent_signature_path FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Work order not found' });
    const oldPath = orders[0].superintendent_signature_path;
    await pool.query(
      `UPDATE work_orders SET superintendent_signature_path = NULL, superintendent_signature_signed_by = NULL, superintendent_signature_signed_at = NULL WHERE id = ?`,
      [req.params.id]
    );
    if (oldPath) {
      try {
        const oldName = path.basename(String(oldPath).replace(/^\/+/, ''));
        if (oldName) fs.unlinkSync(path.join(__dirname, '..', 'uploads', 'signatures', oldName));
      } catch (_) {
        /* ignore */
      }
    }
    await logActivity(req.user.id, 'UPDATE', 'work_order', req.params.id, 'Firma del superintendente eliminada', req.ip);
    res.json({ message: 'Firma del superintendente eliminada' });
  } catch (error) {
    console.error('Superintendent signature delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Firma de conformidad (Capataz; superintendente solo por imagen adjunta en admin)
router.post('/:id/conformity-signature', authenticateToken, async (req, res) => {
  try {
    const { signatureData, signedBy, role } = req.body;
    if (role === 'superintendente' || (role || '').toLowerCase() === 'superintendente') {
      return res.status(403).json({ error: 'La firma del superintendente se adjunta desde administración (pestaña Firma)' });
    }
    if (!signatureData || !signedBy || typeof signedBy !== 'string' || signedBy.trim() === '') {
      return res.status(400).json({ error: 'Se requiere firma y nombre del capataz' });
    }
    const pool = await getConnection();
    const [orders] = await pool.query('SELECT id, assigned_technician_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Work order not found' });
    if (req.user.role === 'technician') {
      const ok = await technicianHasAccessToWorkOrder(pool, parseInt(req.params.id, 10), req.user.id);
      if (!ok) return res.status(403).json({ error: 'Access denied' });
    }
    await pool.query(
      `INSERT INTO work_order_conformity_signatures (work_order_id, signature_role, signature_data, signed_by_name)
       VALUES (?, 'capataz', ?, ?)
       ON DUPLICATE KEY UPDATE signature_data = VALUES(signature_data), signed_by_name = VALUES(signed_by_name), signed_at = CURRENT_TIMESTAMP`,
      [req.params.id, signatureData, signedBy.trim()]
    );
    await logActivity(req.user.id, 'CONFORMITY_SIGNATURE', 'work_order', req.params.id, `Firma de conformidad (Capataz) por ${signedBy.trim()}`, req.ip);
    res.status(201).json({ message: 'Firma del Capataz registrada' });
  } catch (error) {
    console.error('Conformity signature error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get both conformity signatures for work order
router.get('/:id/conformity-signature', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [orders] = await pool.query('SELECT assigned_technician_id FROM work_orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Work order not found' });
    if (req.user.role === 'technician') {
      const ok = await technicianHasAccessToWorkOrder(pool, parseInt(req.params.id, 10), req.user.id);
      if (!ok) return res.status(403).json({ error: 'Access denied' });
    }
    const [rows] = await pool.query(
      'SELECT id, signature_role, signature_data, signed_by_name, signed_at FROM work_order_conformity_signatures WHERE work_order_id = ?',
      [req.params.id]
    );
    const capataz = rows.find((r) => (r.signature_role || '').toLowerCase() === 'capataz') || null;
    const superintendente = rows.find((r) => (r.signature_role || '').toLowerCase() === 'superintendente') || null;
    res.json({ capataz, superintendente });
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

