/**
 * Inicio del día calendario en hora local (evita desfaces por huso horario al comparar fechas).
 */
function startOfLocalDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Días trabajados de la OT: siempre calculados (no hay campo manual en BD).
 * - Desde fecha de inicio hasta hoy si la OT no tiene fecha de completación.
 * - Hasta la fecha de completación si está registrada (trabajo cerrado en esa fecha).
 *
 * Se cuentan días calendario inclusivos en zona horaria local (mismo día inicio/fin = 1 día).
 *
 * @param {object} order - Objeto OT con start_date y opcionalmente completion_date
 * @returns {number|null} null si no hay fecha de inicio; 0 si completación es anterior al inicio; ≥1 en caso normal
 */
export function getWorkingDaysCount(order) {
  if (!order?.start_date) return null;

  const start = startOfLocalDay(order.start_date);
  if (!start) return null;

  const endSource = order.completion_date ? order.completion_date : new Date();
  const end = startOfLocalDay(endSource);
  if (!end) return null;

  const msPerDay = 86400000;
  const diffDays = Math.round((end.getTime() - start.getTime()) / msPerDay);
  if (diffDays < 0) return 0;

  return diffDays + 1;
}
