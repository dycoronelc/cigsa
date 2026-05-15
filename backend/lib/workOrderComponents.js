/** Maestro y líneas de componentes por servicio en OT (nivel entre servicio y alojamiento). */

export const GENERAL_COMPONENT_NAME = 'Componente General';

export async function getGeneralComponentId(pool) {
  const [rows] = await pool.query(
    'SELECT id FROM components WHERE name = ? LIMIT 1',
    [GENERAL_COMPONENT_NAME]
  );
  return rows[0]?.id ?? null;
}

function measureCodeOf(h) {
  return (h.measureCode || h.measure_code || '').toString().trim();
}

export function totalHousingCountFromComponents(components) {
  return (components || []).reduce((sum, c) => {
    const list = Array.isArray(c.housings) ? c.housings : [];
    const n = list.length > 0 ? list.length : Number(c.housingCount) || 0;
    return sum + n;
  }, 0);
}

/** Normaliza payload de servicio: components[] o legacy housings en servicio. */
export function normalizeServiceComponents(service, housingsAllowed, generalComponentId) {
  let components = Array.isArray(service.components) ? [...service.components] : [];

  if (components.length === 0) {
    const legacyHousings = Array.isArray(service.housings) ? service.housings : [];
    const legacyCount = Number(service.housingCount) || legacyHousings.length || 0;
    if (generalComponentId && (legacyHousings.length > 0 || legacyCount > 0 || housingsAllowed)) {
      components = [
        {
          componentId: generalComponentId,
          housingCount: legacyCount,
          housings: legacyHousings
        }
      ];
    } else if (generalComponentId) {
      components = [{ componentId: generalComponentId, housingCount: 0, housings: [] }];
    }
  }

  if (!housingsAllowed) {
    components = components.map((c) => ({ ...c, housingCount: 0, housings: [] }));
  }

  return { ...service, components };
}

export function validateComponentsHousings(components) {
  for (const comp of components || []) {
    const housings = Array.isArray(comp.housings) ? comp.housings : [];
    if (housings.some((h) => !measureCodeOf(h))) {
      return 'Cada alojamiento debe tener un campo Medida (A, B, C...)';
    }
  }
  return null;
}

export async function insertComponentsAndHousings(pool, workOrderId, wosId, components) {
  for (const comp of components || []) {
    const componentId = comp.componentId ?? comp.component_id;
    if (!componentId) continue;

    const housings = Array.isArray(comp.housings) ? comp.housings : [];
    const housingCount = housings.length > 0 ? housings.length : Number(comp.housingCount) || 0;

    const [woscRes] = await pool.query(
      'INSERT INTO work_order_service_components (work_order_service_id, component_id, housing_count) VALUES (?, ?, ?)',
      [wosId, componentId, housingCount]
    );
    const woscId = woscRes.insertId;

    if (housings.length === 0) continue;

    const values = housings.map((h) => [
      workOrderId,
      wosId,
      woscId,
      measureCodeOf(h) || null,
      h.description || null,
      h.nominalValue !== undefined && h.nominalValue !== null && h.nominalValue !== ''
        ? h.nominalValue
        : null,
      h.unit || h.nominalUnit || h.nominal_unit || null,
      h.tolerance || null
    ]);

    await pool.query(
      `INSERT INTO work_order_housings
       (work_order_id, work_order_service_id, work_order_service_component_id, measure_code, description, nominal_value, nominal_unit, tolerance)
       VALUES ?`,
      [values]
    );
  }
}

/** Adjunta components[] (con housings) a cada línea de servicio. */
export async function attachComponentsToOrderServices(pool, workOrderId, orderServices) {
  const wosIds = (orderServices || []).map((s) => s.id).filter(Boolean);
  if (wosIds.length === 0) return;

  let componentRows = [];
  let housingRows = [];
  try {
    const [cRows] = await pool.query(
      `SELECT wosc.id, wosc.work_order_service_id, wosc.component_id, wosc.housing_count,
              c.name AS component_name, c.description AS component_description
       FROM work_order_service_components wosc
       JOIN components c ON c.id = wosc.component_id
       WHERE wosc.work_order_service_id IN (?)
       ORDER BY wosc.id`,
      [wosIds]
    );
    componentRows = cRows || [];
  } catch (e) {
    console.warn('attachComponentsToOrderServices (components):', e.message);
    return;
  }

  try {
    const [hRows] = await pool.query(
      `SELECT wh.*, wosc.component_id, c.name AS component_name
       FROM work_order_housings wh
       LEFT JOIN work_order_service_components wosc ON wh.work_order_service_component_id = wosc.id
       LEFT JOIN components c ON wosc.component_id = c.id
       WHERE wh.work_order_id = ?
       ORDER BY wh.work_order_service_component_id, wh.id`,
      [workOrderId]
    );
    housingRows = hRows || [];
  } catch (e) {
    console.warn('attachComponentsToOrderServices (housings):', e.message);
  }

  (orderServices || []).forEach((svc) => {
    if (!svc.id) {
      svc.components = [];
      svc.housings = [];
      return;
    }
    const comps = componentRows
      .filter((r) => r.work_order_service_id === svc.id)
      .map((r) => {
        const compHousings = housingRows.filter(
          (h) =>
            h.work_order_service_component_id === r.id ||
            (!h.work_order_service_component_id && h.work_order_service_id === svc.id)
        );
        return {
          id: r.id,
          component_id: r.component_id,
          component_name: r.component_name,
          component_description: r.component_description,
          housing_count: r.housing_count,
          housings: compHousings
        };
      });

    svc.components = comps;
    svc.housings = housingRows.filter((h) => h.work_order_service_id === svc.id);
  });
}

/** Query enriquecida para mediciones por alojamiento (incluye componente). */
export const HOUSING_MEASUREMENTS_SELECT = `
  SELECT 
    wohm.*,
    woh.measure_code,
    woh.description as housing_description,
    woh.nominal_value,
    woh.nominal_unit,
    woh.tolerance,
    woh.work_order_service_id,
    woh.work_order_service_component_id,
    wosc.component_id,
    c.name as component_name,
    s.code as service_code,
    s.name as service_name
  FROM work_order_housing_measurements wohm
  JOIN work_order_housings woh ON wohm.housing_id = woh.id
  JOIN measurements m ON wohm.measurement_id = m.id
  LEFT JOIN work_order_services wos ON woh.work_order_service_id = wos.id
  LEFT JOIN services s ON wos.service_id = s.id
  LEFT JOIN work_order_service_components wosc ON woh.work_order_service_component_id = wosc.id
  LEFT JOIN components c ON wosc.component_id = c.id
`;

/** Lista plana de alojamientos con datos de servicio y componente (para mediciones / PDF). */
/**
 * Sincroniza componentes y alojamientos de un servicio (cuando ya puede haber mediciones).
 * Retorna { error } si no se puede eliminar por mediciones.
 */
export async function syncServiceComponentsAndHousings(pool, workOrderId, wosId, components) {
  const [existingWosc] = await pool.query(
    'SELECT id, component_id FROM work_order_service_components WHERE work_order_service_id = ?',
    [wosId]
  );
  const woscByComponentId = new Map((existingWosc || []).map((r) => [Number(r.component_id), r]));

  const payloadComponentIds = new Set();

  for (const comp of components || []) {
    const componentId = Number(comp.componentId ?? comp.component_id);
    if (!componentId) continue;
    payloadComponentIds.add(componentId);

    const housings = Array.isArray(comp.housings) ? comp.housings : [];
    const housingCount = housings.length > 0 ? housings.length : Number(comp.housingCount) || 0;

    let woscId;
    const existingRow = woscByComponentId.get(componentId);
    if (existingRow) {
      woscId = existingRow.id;
      await pool.query('UPDATE work_order_service_components SET housing_count = ? WHERE id = ?', [
        housingCount,
        woscId
      ]);
    } else {
      const [ins] = await pool.query(
        'INSERT INTO work_order_service_components (work_order_service_id, component_id, housing_count) VALUES (?, ?, ?)',
        [wosId, componentId, housingCount]
      );
      woscId = ins.insertId;
    }

    for (const h of housings) {
      const code = measureCodeOf(h);
      if (!code) continue;
      const nomVal =
        h.nominalValue !== undefined && h.nominalValue !== null && h.nominalValue !== '' ? h.nominalValue : null;
      const nomUnit = h.unit || h.nominalUnit || h.nominal_unit || null;
      const tol = h.tolerance || null;
      const desc = h.description || null;

      const [whRows] = await pool.query(
        'SELECT id FROM work_order_housings WHERE work_order_id = ? AND work_order_service_component_id = ? AND measure_code = ?',
        [workOrderId, woscId, code]
      );
      if (whRows.length > 0) {
        await pool.query(
          `UPDATE work_order_housings SET nominal_value = ?, nominal_unit = ?, tolerance = ?, description = ?,
           work_order_service_id = ? WHERE id = ?`,
          [nomVal, nomUnit, tol, desc, wosId, whRows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO work_order_housings
           (work_order_id, work_order_service_id, work_order_service_component_id, measure_code, description, nominal_value, nominal_unit, tolerance)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [workOrderId, wosId, woscId, code, desc, nomVal, nomUnit, tol]
        );
      }
    }

    if (housings.length === 0 && housingCount > 0) {
      continue;
    }

    const payloadCodes = new Set(housings.map((h) => measureCodeOf(h)).filter(Boolean));
    const [dbHousingRows] = await pool.query(
      'SELECT id, measure_code FROM work_order_housings WHERE work_order_id = ? AND work_order_service_component_id = ?',
      [workOrderId, woscId]
    );
    for (const dbH of dbHousingRows || []) {
      const code = measureCodeOf(dbH);
      if (!code || payloadCodes.has(code)) continue;
      const [mref] = await pool.query(
        'SELECT COUNT(*) AS c FROM work_order_housing_measurements WHERE housing_id = ?',
        [dbH.id]
      );
      if ((mref[0]?.c || 0) > 0) {
        return {
          error: `No se puede eliminar el alojamiento «${code}»: tiene mediciones registradas.`
        };
      }
      await pool.query('DELETE FROM work_order_housings WHERE id = ? AND work_order_id = ?', [dbH.id, workOrderId]);
    }
  }

  for (const row of existingWosc || []) {
    if (payloadComponentIds.has(Number(row.component_id))) continue;
    const [cntRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM work_order_housing_measurements whm
       INNER JOIN work_order_housings wh ON wh.id = whm.housing_id
       WHERE wh.work_order_service_component_id = ?`,
      [row.id]
    );
    if ((cntRows[0]?.c || 0) > 0) {
      return {
        error:
          'No se puede quitar un componente que ya tiene mediciones registradas en sus alojamientos.'
      };
    }
    await pool.query('DELETE FROM work_order_service_components WHERE id = ?', [row.id]);
  }

  const totalCount = totalHousingCountFromComponents(components);
  await pool.query('UPDATE work_order_services SET housing_count = ? WHERE id = ?', [totalCount, wosId]);
  return { error: null, housingCount: totalCount };
}

export async function fetchServiceHousingsFlat(pool, workOrderId) {
  const [rows] = await pool.query(
    `SELECT wh.*,
            wos.service_id,
            s.code AS service_code,
            s.name AS service_name,
            wosc.component_id,
            c.name AS component_name
     FROM work_order_housings wh
     LEFT JOIN work_order_services wos ON wh.work_order_service_id = wos.id
     LEFT JOIN services s ON wos.service_id = s.id
     LEFT JOIN work_order_service_components wosc ON wh.work_order_service_component_id = wosc.id
     LEFT JOIN components c ON wosc.component_id = c.id
     WHERE wh.work_order_id = ?
     ORDER BY wos.id, wosc.id, wh.id`,
    [workOrderId]
  );
  return rows || [];
}
