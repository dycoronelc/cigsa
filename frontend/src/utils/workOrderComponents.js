export const GENERAL_COMPONENT_NAME = 'Componente General';

export function findGeneralComponentId(catalog) {
  const row = (catalog || []).find((c) => c.name === GENERAL_COMPONENT_NAME);
  return row?.id ?? null;
}

export function createDefaultComponent(generalComponentId) {
  return {
    componentId: generalComponentId != null ? String(generalComponentId) : '',
    housingCount: 0,
    housings: []
  };
}

export function mapHousingFromApi(h) {
  return {
    measureCode: h.measure_code || h.measureCode || '',
    description: h.description || '',
    nominalValue: h.nominal_value != null ? String(h.nominal_value) : '',
    nominalUnit: h.nominal_unit || h.nominalUnit || '',
    tolerance: h.tolerance || ''
  };
}

export function mapComponentsFromApi(components, generalComponentId) {
  if (!Array.isArray(components) || components.length === 0) {
    return [createDefaultComponent(generalComponentId)];
  }
  return components.map((c) => ({
    componentId: String(c.component_id ?? c.componentId ?? generalComponentId ?? ''),
    housingCount: (c.housings || []).length || c.housing_count || 0,
    housings: (c.housings || []).map(mapHousingFromApi)
  }));
}

export function mapComponentsToPayload(components, needsHousings) {
  return (components || []).map((c) => {
    const housingCount = parseInt(c.housingCount, 10) || 0;
    const housings = needsHousings ? (c.housings || []).slice(0, housingCount) : [];
    return {
      componentId: parseInt(c.componentId, 10),
      housingCount: needsHousings ? housingCount : 0,
      housings: needsHousings
        ? housings.map((h) => ({
            measureCode: h.measureCode,
            description: h.description,
            nominalValue: h.nominalValue !== '' ? parseFloat(h.nominalValue) : null,
            nominalUnit: h.nominalValue !== '' ? h.nominalUnit || null : null,
            tolerance: h.tolerance || null
          }))
        : []
    };
  });
}

export function totalHousingCount(components) {
  return (components || []).reduce((sum, c) => {
    const n = parseInt(c.housingCount, 10) || (c.housings || []).length || 0;
    return sum + n;
  }, 0);
}
