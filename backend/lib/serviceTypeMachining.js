const MACHINING_SERVICE_TYPE_LABEL = 'Reparación por Mecanizado';

function normalizeServiceTypeName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** True si el nombre del tipo de servicio es «Reparación por Mecanizado» (misma normalización que en el front). */
export function isMachiningRepairTypeName(name) {
  return normalizeServiceTypeName(name) === normalizeServiceTypeName(MACHINING_SERVICE_TYPE_LABEL);
}
