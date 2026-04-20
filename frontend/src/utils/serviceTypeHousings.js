/** Nombre canónico del tipo de OT que requiere alojamientos (debe coincidir con `service_types` en BD). */
export const MACHINING_SERVICE_TYPE_LABEL = 'Reparación por Mecanizado';

function normalizeServiceTypeName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Indica si el nombre del tipo de servicio corresponde a reparación por mecanizado. */
export function isMachiningRepairByTypeName(serviceTypeName) {
  return normalizeServiceTypeName(serviceTypeName) === normalizeServiceTypeName(MACHINING_SERVICE_TYPE_LABEL);
}

/** Indica si el tipo de servicio de la OT (por id en el listado cargado) es reparación por mecanizado. */
export function isMachiningRepairServiceType(serviceTypes, serviceTypeId) {
  if (!serviceTypeId) return false;
  const st = (serviceTypes || []).find((t) => String(t.id) === String(serviceTypeId));
  return st?.name ? isMachiningRepairByTypeName(st.name) : false;
}
