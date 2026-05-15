import './WorkOrderComponentsEditor.css';

/**
 * Bloque de componentes por línea de servicio en OT (maestro + alojamientos si mecanizado).
 */
export default function WorkOrderServiceComponentsEditor({
  components = [],
  componentsCatalog = [],
  needsOrderHousings = false,
  generalComponentId = null,
  createDefaultComponent,
  onUpdateComponent,
  onAddComponent,
  onRemoveComponent,
  onOpenHousingsModal
}) {
  const list =
    components.length > 0 ? components : [createDefaultComponent(generalComponentId)];

  return (
    <div className="wo-components-section">
      <span className="wo-components-section__title">Componentes</span>
      {list.map((comp, ci) => (
        <div key={ci} className="wo-component-block">
          <div className="wo-component-block__top">
            <div className="wo-component-block__select-wrap">
              <label className="wo-component-block__label">Componente</label>
              <select
                className="wo-component-block__select"
                value={comp.componentId}
                onChange={(e) => onUpdateComponent(ci, 'componentId', e.target.value)}
              >
                <option value="">Seleccionar componente...</option>
                {componentsCatalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {list.length > 1 && (
              <button
                type="button"
                className="btn-secondary wo-component-block__remove"
                onClick={() => onRemoveComponent(ci)}
                title="Quitar componente"
              >
                ✕
              </button>
            )}
          </div>
          {needsOrderHousings && (
            <div className="wo-component-block__housing">
              <div className="wo-component-block__housing-field">
                <label className="wo-component-block__label">Alojamientos</label>
                <input
                  type="number"
                  min="0"
                  value={comp.housingCount || ''}
                  onChange={(e) => onUpdateComponent(ci, 'housingCount', e.target.value)}
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenHousingsModal(ci)}
                title="Configurar alojamientos"
                style={{ padding: '8px 12px', flexShrink: 0 }}
              >
                📋
              </button>
            </div>
          )}
        </div>
      ))}
      <button type="button" className="btn-secondary wo-components-section__add" onClick={onAddComponent}>
        + Agregar componente
      </button>
    </div>
  );
}
