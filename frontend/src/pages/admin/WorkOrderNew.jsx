import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import SearchableSelect from '../../components/SearchableSelect';
import { isMachiningRepairServiceType } from '../../utils/serviceTypeHousings';
import { SHIFT_DAY, SHIFT_NIGHT, shiftLabel } from '../../utils/serviceTechnicianShift';
import {
  createDefaultComponent,
  findGeneralComponentId,
  mapComponentsToPayload,
  totalHousingCount,
  GENERAL_COMPONENT_NAME
} from '../../utils/workOrderComponents';
import './WorkOrderNew.css';

export default function WorkOrderNew() {
  const navigate = useNavigate();
  const { alertDialog, showError, showSuccess, showWarning, closeAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [componentsCatalog, setComponentsCatalog] = useState([]);
  const [generalComponentId, setGeneralComponentId] = useState(null);
  const [showHousingsModal, setShowHousingsModal] = useState(false);
  const [editingServiceIdx, setEditingServiceIdx] = useState(null);
  const [editingComponentIdx, setEditingComponentIdx] = useState(null);
  const emptyService = () => ({
    serviceId: '',
    technicians: [{ technicianId: '', shift: SHIFT_DAY }],
    components: [createDefaultComponent(generalComponentId)]
  });
  const [orderServices, setOrderServices] = useState([emptyService()]);
  const [formData, setFormData] = useState({
    clientId: '',
    equipmentId: '',
    locationId: '',
    serviceTypeId: '',
    clientServiceOrderNumber: '',
    title: '',
    description: '',
    priority: 'medium',
    scheduledDate: ''
  });

  const servicesForOrder = formData.serviceTypeId
    ? services.filter((s) => String(s.service_type_id) === String(formData.serviceTypeId))
    : services;
  const needsOrderHousings = isMachiningRepairServiceType(serviceTypes, formData.serviceTypeId);

  const numberToLetters = (n) => {
    let num = n;
    let s = '';
    while (num > 0) {
      const mod = (num - 1) % 26;
      s = String.fromCharCode(65 + mod) + s;
      num = Math.floor((num - 1) / 26);
    }
    return s;
  };

  const openHousingsModalForComponent = (serviceIdx, componentIdx) => {
    if (!needsOrderHousings) return;
    const comp = orderServices[serviceIdx]?.components?.[componentIdx];
    const count = Number(comp?.housingCount) || 0;
    if (!Number.isFinite(count) || count <= 0) {
      showWarning('Indique la cantidad de alojamientos del componente antes de configurarlos.');
      return;
    }
    const existing = comp?.housings || [];
    const nextHousings = Array.from({ length: count }).map((_, i) => {
      if (existing[i]) return existing[i];
      return {
        measureCode: numberToLetters(i + 1),
        description: '',
        nominalValue: '',
        nominalUnit: '',
        tolerance: ''
      };
    });
    const nextServices = [...orderServices];
    const comps = [...(nextServices[serviceIdx].components || [])];
    comps[componentIdx] = { ...comps[componentIdx], housings: nextHousings };
    nextServices[serviceIdx] = { ...nextServices[serviceIdx], components: comps };
    setOrderServices(nextServices);
    setEditingServiceIdx(serviceIdx);
    setEditingComponentIdx(componentIdx);
    setShowHousingsModal(true);
  };

  const closeHousingsModal = (save = false) => {
    if (save && editingServiceIdx !== null && editingComponentIdx !== null) {
      const housings = orderServices[editingServiceIdx]?.components?.[editingComponentIdx]?.housings || [];
      const hasMissing = housings.some(
        (h) => !h.measureCode || !h.description || (h.nominalValue !== '' && !h.nominalUnit)
      );
      if (hasMissing) {
        showWarning('Complete Medida y Descripción. Si ingresa Medida Nominal, también indique la Unidad.');
        return;
      }
    }
    setShowHousingsModal(false);
    setEditingServiceIdx(null);
    setEditingComponentIdx(null);
  };

  const updateHousing = (idx, field, value) => {
    if (editingServiceIdx === null || editingComponentIdx === null) return;
    const next = [...orderServices];
    const comps = [...(next[editingServiceIdx].components || [])];
    const h = [...(comps[editingComponentIdx].housings || [])];
    if (h[idx]) {
      h[idx] = { ...h[idx], [field]: value };
      comps[editingComponentIdx] = { ...comps[editingComponentIdx], housings: h };
      next[editingServiceIdx] = { ...next[editingServiceIdx], components: comps };
      setOrderServices(next);
    }
  };

  const addComponentToService = (serviceIdx) => {
    const next = [...orderServices];
    const comps = [...(next[serviceIdx].components || []), createDefaultComponent(generalComponentId)];
    next[serviceIdx] = { ...next[serviceIdx], components: comps };
    setOrderServices(next);
  };

  const removeComponentFromService = (serviceIdx, componentIdx) => {
    const next = [...orderServices];
    const comps = (next[serviceIdx].components || []).filter((_, i) => i !== componentIdx);
    next[serviceIdx] = {
      ...next[serviceIdx],
      components: comps.length ? comps : [createDefaultComponent(generalComponentId)]
    };
    setOrderServices(next);
  };

  const updateServiceComponent = (serviceIdx, componentIdx, field, value) => {
    const next = [...orderServices];
    const comps = [...(next[serviceIdx].components || [])];
    if (!comps[componentIdx]) return;
    comps[componentIdx] = { ...comps[componentIdx], [field]: value };
    if (field === 'housingCount' && needsOrderHousings) {
      const count = Number(value) || 0;
      const existing = comps[componentIdx].housings || [];
      if (count > 0) {
        comps[componentIdx].housings = Array.from({ length: count }).map((_, i) => {
          if (existing[i]) return existing[i];
          return {
            measureCode: numberToLetters(i + 1),
            description: '',
            nominalValue: '',
            nominalUnit: '',
            tolerance: ''
          };
        });
        next[serviceIdx] = { ...next[serviceIdx], components: comps };
        setOrderServices(next);
        setEditingServiceIdx(serviceIdx);
        setEditingComponentIdx(componentIdx);
        setShowHousingsModal(true);
        return;
      }
      comps[componentIdx].housings = [];
    }
    next[serviceIdx] = { ...next[serviceIdx], components: comps };
    setOrderServices(next);
  };

  const addService = () => {
    setOrderServices([...orderServices, emptyService()]);
  };

  const addTechnicianRow = (serviceIdx) => {
    const next = [...orderServices];
    const techs = [...(next[serviceIdx].technicians || []), { technicianId: '', shift: SHIFT_DAY }];
    next[serviceIdx] = { ...next[serviceIdx], technicians: techs };
    setOrderServices(next);
  };

  const removeTechnicianRow = (serviceIdx, techIdx) => {
    const next = [...orderServices];
    const techs = (next[serviceIdx].technicians || []).filter((_, i) => i !== techIdx);
    next[serviceIdx] = { ...next[serviceIdx], technicians: techs.length ? techs : [{ technicianId: '', shift: SHIFT_DAY }] };
    setOrderServices(next);
  };

  const updateServiceTechnician = (serviceIdx, techIdx, field, value) => {
    const next = [...orderServices];
    const techs = [...(next[serviceIdx].technicians || [])];
    if (techs[techIdx]) {
      techs[techIdx] = { ...techs[techIdx], [field]: value };
      next[serviceIdx] = { ...next[serviceIdx], technicians: techs };
      setOrderServices(next);
    }
  };

  const removeService = (idx) => {
    setOrderServices(orderServices.filter((_, i) => i !== idx));
  };

  const updateService = (idx, field, value) => {
    const next = [...orderServices];
    next[idx] = { ...next[idx], [field]: value };
    setOrderServices(next);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.clientId) {
      fetchEquipment(formData.clientId);
    } else {
      setEquipment([]);
    }
  }, [formData.clientId]);

  const fetchData = async () => {
    try {
      const [clientsRes, servicesRes, techniciansRes, locationsRes, typesRes, componentsRes] = await Promise.all([
        api.get('/clients'),
        api.get('/services'),
        api.get('/technicians'),
        api.get('/locations'),
        api.get('/service-types'),
        api.get('/components')
      ]);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setTechnicians(techniciansRes.data);
      setLocations(locationsRes.data);
      setServiceTypes(typesRes.data);
      const compList = componentsRes.data || [];
      setComponentsCatalog(compList);
      const gId = findGeneralComponentId(compList);
      setGeneralComponentId(gId);
      setOrderServices((prev) =>
        prev.map((os) => ({
          ...os,
          components: (os.components || []).map((c) =>
            c.componentId ? c : createDefaultComponent(gId)
          )
        }))
      );
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchEquipment = async (clientId) => {
    try {
      const response = await api.get(`/equipment?clientId=${clientId}`);
      setEquipment(response.data);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.clientId) {
        showWarning('Seleccione un cliente.');
        setLoading(false);
        return;
      }
      if (!formData.equipmentId) {
        showWarning('Seleccione un equipo.');
        setLoading(false);
        return;
      }

      const servicesPayload = orderServices
        .filter(s => s.serviceId)
        .map(s => {
          const techRows = (s.technicians || []).filter((t) => t.technicianId);
          if (techRows.length === 0) {
            throw new Error('Cada servicio debe tener al menos un técnico (turno Día/DS o Noche/NS).');
          }
          const technicians = techRows.map((t) => ({
            technicianId: parseInt(t.technicianId, 10),
            shift: t.shift === SHIFT_NIGHT ? SHIFT_NIGHT : SHIFT_DAY
          }));
          const components = mapComponentsToPayload(s.components, needsOrderHousings);
          if (needsOrderHousings) {
            for (const comp of components) {
              if (!comp.componentId) {
                throw new Error('Seleccione el componente en cada línea de servicio.');
              }
              const housings = comp.housings || [];
              const hasMissing = housings.some(
                (h) => !h.measureCode || !h.description || (h.nominalValue != null && h.nominalValue !== '' && !h.nominalUnit)
              );
              if (comp.housingCount > 0 && hasMissing) {
                throw new Error('Complete los alojamientos de cada componente.');
              }
              if (comp.housingCount > 0 && housings.length !== comp.housingCount) {
                throw new Error('Debe completar la información de todos los alojamientos.');
              }
            }
          }
          return {
            serviceId: parseInt(s.serviceId, 10),
            housingCount: totalHousingCount(s.components),
            technicians,
            components
          };
        });

      if (
        needsOrderHousings &&
        servicesPayload.some((s) => {
          const comps = s.components || [];
          return comps.some((c) => c.housingCount > 0 && (c.housings || []).length !== c.housingCount);
        })
      ) {
        showWarning('Debe completar la información de los alojamientos de cada componente.');
        setLoading(false);
        return;
      }

      const response = await api.post('/work-orders', {
        clientId: parseInt(formData.clientId),
        equipmentId: parseInt(formData.equipmentId),
        services: servicesPayload,
        locationId: formData.locationId || null,
        serviceTypeId: formData.serviceTypeId || null,
        clientServiceOrderNumber: formData.clientServiceOrderNumber || null,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        scheduledDate: formData.scheduledDate || null
      });

      showSuccess('Orden de trabajo creada exitosamente');
      setTimeout(() => {
        navigate(`/admin/work-orders/${response.data.id}`);
      }, 1000);
    } catch (error) {
      if (error instanceof Error && error.message) {
        showWarning(error.message);
      } else {
        showError(error.response?.data?.error || 'Error al crear la orden de trabajo');
      }
    } finally {
      setLoading(false);
    }
  };

  const currentHousings =
    editingServiceIdx !== null && editingComponentIdx !== null
      ? orderServices[editingServiceIdx]?.components?.[editingComponentIdx]?.housings || []
      : [];
  let currentServiceName = 'Servicio';
  let currentComponentName = 'Componente';
  if (editingServiceIdx !== null && orderServices[editingServiceIdx]?.serviceId) {
    const svc = servicesForOrder.find((s) => s.id === parseInt(orderServices[editingServiceIdx].serviceId, 10));
    currentServiceName = svc?.name || 'Servicio';
  }
  if (editingComponentIdx !== null) {
    const compId = orderServices[editingServiceIdx]?.components?.[editingComponentIdx]?.componentId;
    const compRow = componentsCatalog.find((c) => String(c.id) === String(compId));
    currentComponentName = compRow?.name || GENERAL_COMPONENT_NAME;
  }

  return (
    <div className="work-order-new">
      <div className="page-header">
        <button onClick={() => navigate('/admin/work-orders')} className="btn-back">
          ← Volver
        </button>
        <h1>Nueva Orden de Trabajo</h1>
      </div>

      <form onSubmit={handleSubmit} className="work-order-form">
        <div className="form-section">
          <h2>Información Básica</h2>
          
          <div className="form-group">
            <label htmlFor="clientId">Cliente *</label>
            <select
              id="clientId"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value, equipmentId: '' })}
              required
            >
              <option value="">Seleccionar Cliente</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.company_name ? `- ${client.company_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="equipmentId">Equipo *</label>
            <SearchableSelect
              id="equipmentId"
              value={formData.equipmentId}
              onChange={(val) => setFormData({ ...formData, equipmentId: val })}
              options={equipment.map((eq) => ({
                value: String(eq.id),
                label: `${eq.brand_name} ${eq.model_name} - ${eq.serial_number}${eq.client_name ? ` (${eq.client_name})` : ''}`
              }))}
              placeholder={formData.clientId ? 'Escriba para buscar equipo...' : 'Primero seleccione un cliente'}
              disabled={!formData.clientId}
            />
          </div>

          <div className="form-group">
            <label htmlFor="locationId">Ubicación del Servicio</label>
            <select
              id="locationId"
              value={formData.locationId}
              onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
            >
              <option value="">Seleccionar ubicación</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="serviceTypeId">Tipo de Servicio</label>
            <select
              id="serviceTypeId"
              value={formData.serviceTypeId}
              onChange={(e) => {
                const nextType = e.target.value;
                setFormData({ ...formData, serviceTypeId: nextType });
                if (!isMachiningRepairServiceType(serviceTypes, nextType)) {
                  setOrderServices((prev) =>
                    prev.map((os) => ({
                      ...os,
                      components: (os.components || [createDefaultComponent(generalComponentId)]).map((c) => ({
                        ...c,
                        housingCount: 0,
                        housings: []
                      })),
                      technicians: os.technicians?.length ? os.technicians : [{ technicianId: '', shift: SHIFT_DAY }]
                    }))
                  );
                  setShowHousingsModal(false);
                  setEditingServiceIdx(null);
                  setEditingComponentIdx(null);
                }
              }}
            >
              <option value="">Seleccionar tipo de servicio</option>
              {serviceTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
            <p style={{ marginTop: 4, marginBottom: 0, color: '#6e6b7b', fontSize: '0.85em' }}>
              Al seleccionar un tipo, solo se listan los servicios de ese tipo.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="clientServiceOrderNumber">N° Orden de Servicio del Cliente</label>
            <input
              type="text"
              id="clientServiceOrderNumber"
              value={formData.clientServiceOrderNumber}
              onChange={(e) => setFormData({ ...formData, clientServiceOrderNumber: e.target.value })}
              placeholder="Ej: OS-12345"
            />
          </div>

          <div className="form-group">
            <label htmlFor="title">Título de la Orden *</label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Reparación de soldadura en equipo X"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción detallada del trabajo a realizar..."
              rows="4"
            />
          </div>

          <div className="form-group">
            <label>Servicios</label>
            <p style={{ marginTop: -4, marginBottom: 8, color: '#6e6b7b', fontSize: '0.9em' }}>
              {formData.serviceTypeId ? 'Servicios del tipo seleccionado. ' : 'Seleccione primero un Tipo de Servicio para filtrar los servicios. '}
              {needsOrderHousings
                ? 'Agregue servicios. En cada servicio defina uno o más componentes; en mecanizado, indique alojamientos por componente.'
                : 'Agregue uno o más servicios. Los alojamientos solo aplican al tipo «Reparación por Mecanizado», por componente.'}
            </p>
            {orderServices.map((os, idx) => (
              <div key={idx} className="service-row" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e8e6ef' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px', minWidth: 0 }}>
                  <SearchableSelect
                    value={os.serviceId}
                    onChange={(val) => {
                      updateService(idx, 'serviceId', val);
                      if (val && !formData.title) {
                        const svc = servicesForOrder.find(s => s.id === parseInt(val));
                        if (svc) setFormData(prev => ({ ...prev, title: svc.name }));
                      }
                    }}
                    options={servicesForOrder
                      .filter(s => !orderServices.some((o, i) => i !== idx && o.serviceId === String(s.id)))
                      .map((s) => ({ value: String(s.id), label: `${s.code} - ${s.name}` }))}
                    placeholder={formData.serviceTypeId ? 'Seleccionar servicio...' : 'Seleccione primero un Tipo de Servicio'}
                    disabled={!formData.serviceTypeId}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => removeService(idx)}
                    title="Quitar servicio"
                    style={{ padding: '8px 12px' }}
                  >
                    ✕
                  </button>
                </div>
                </div>
                <div style={{ width: '100%', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e8e6ef' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#5c5966' }}>Técnicos y turno</span>
                  {(os.technicians || [{ technicianId: '', shift: SHIFT_DAY }]).map((t, ti) => (
                    <div key={ti} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                      <select
                        value={t.technicianId}
                        onChange={(e) => updateServiceTechnician(idx, ti, 'technicianId', e.target.value)}
                        style={{ flex: '2 1 180px', minWidth: 140 }}
                      >
                        <option value="">Seleccionar técnico</option>
                        {technicians.map((tech) => (
                          <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                        ))}
                      </select>
                      <select
                        value={t.shift === SHIFT_NIGHT ? SHIFT_NIGHT : SHIFT_DAY}
                        onChange={(e) => updateServiceTechnician(idx, ti, 'shift', e.target.value)}
                        style={{ flex: '1 1 140px', minWidth: 120 }}
                      >
                        <option value={SHIFT_DAY}>{shiftLabel(SHIFT_DAY)}</option>
                        <option value={SHIFT_NIGHT}>{shiftLabel(SHIFT_NIGHT)}</option>
                      </select>
                      <button type="button" className="btn-secondary" style={{ padding: '6px 10px' }} onClick={() => removeTechnicianRow(idx, ti)} title="Quitar técnico">−</button>
                    </div>
                  ))}
                  <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => addTechnicianRow(idx)}>
                    + Agregar técnico
                  </button>
                </div>
                <div style={{ width: '100%', marginTop: 10, padding: '10px 0 4px', borderTop: '1px dashed #e8e6ef' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#5c5966' }}>Componentes</span>
                  {(os.components || [createDefaultComponent(generalComponentId)]).map((comp, ci) => (
                    <div key={ci} style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div style={{ flex: '2 1 180px', minWidth: 140 }}>
                        <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Componente</label>
                        <select
                          value={comp.componentId}
                          onChange={(e) => updateServiceComponent(idx, ci, 'componentId', e.target.value)}
                        >
                          <option value="">Seleccionar...</option>
                          {componentsCatalog.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      {needsOrderHousings && (
                        <>
                          <div style={{ flex: '0 1 90px', minWidth: 80 }}>
                            <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Alojamientos</label>
                            <input
                              type="number"
                              min="0"
                              value={comp.housingCount || ''}
                              onChange={(e) => updateServiceComponent(idx, ci, 'housingCount', e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openHousingsModalForComponent(idx, ci)}
                            title="Configurar alojamientos"
                            style={{ padding: '8px 12px' }}
                          >
                            📋
                          </button>
                        </>
                      )}
                      {(os.components || []).length > 1 && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '8px 12px' }}
                          onClick={() => removeComponentFromService(idx, ci)}
                          title="Quitar componente"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => addComponentToService(idx)}>
                    + Agregar componente
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={addService} style={{ marginTop: 4 }}>
              + Agregar Servicio
            </button>
          </div>
        </div>

        <div className="form-section">
          <h2>Asignación y Prioridad</h2>

          <div className="form-group">
            <label htmlFor="priority">Prioridad</label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="scheduledDate">Fecha Programada</label>
            <input
              type="date"
              id="scheduledDate"
              value={formData.scheduledDate}
              onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/admin/work-orders')} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando...' : 'Crear Orden de Trabajo'}
          </button>
        </div>
      </form>

      {needsOrderHousings && showHousingsModal && editingServiceIdx !== null && editingComponentIdx !== null && (
        <div className="modal-overlay" onClick={() => closeHousingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 750 }}>
            <h2>Alojamientos — {currentServiceName} / {currentComponentName}</h2>
            <p style={{ marginTop: -8, color: '#6e6b7b' }}>
              Complete la información de cada alojamiento. Cada componente comienza con A, B, C...
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medida</th>
                    <th>Descripción</th>
                    <th>Medida Nominal</th>
                    <th>Tolerancia</th>
                    <th>Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {currentHousings.map((h, idx) => (
                    <tr key={h.measureCode + idx}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{h.measureCode}</td>
                      <td>
                        <input
                          value={h.description}
                          onChange={(e) => updateHousing(idx, 'description', e.target.value)}
                          placeholder="Descripción del alojamiento"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.001"
                          value={h.nominalValue}
                          onChange={(e) => updateHousing(idx, 'nominalValue', e.target.value)}
                          placeholder="0.000"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={h.tolerance}
                          onChange={(e) => updateHousing(idx, 'tolerance', e.target.value)}
                          placeholder="+0.5, -0.3, ±0.2"
                        />
                      </td>
                      <td>
                        <input
                          value={h.nominalUnit}
                          onChange={(e) => updateHousing(idx, 'nominalUnit', e.target.value)}
                          placeholder="mm, in, etc."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => closeHousingsModal(false)}>Cerrar</button>
              <button type="button" className="btn-primary" onClick={() => closeHousingsModal(true)}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={closeAlert}
        type={alertDialog.type}
        title={alertDialog.title}
        message={alertDialog.message}
        onConfirm={alertDialog.onConfirm}
        showCancel={alertDialog.showCancel}
      />
    </div>
  );
}

