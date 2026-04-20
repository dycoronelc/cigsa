export const SHIFT_DAY = 'day';
export const SHIFT_NIGHT = 'night';

/** Etiqueta para UI y payloads (API usa day | night) */
export function shiftLabel(shift) {
  if (shift === SHIFT_NIGHT || shift === 'night') return 'Noche / NS';
  return 'Día / DS';
}
