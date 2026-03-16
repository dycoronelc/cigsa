import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import SearchableSelect from '../../components/SearchableSelect';
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
  const [showHousingsModal, setShowHousingsModal] = useState(false);
  const [editingServiceIdx, setEditingServiceIdx] = useState(null);
  const [orderServices, setOrderServices] = useState([{ serviceId: '', housingCount: 0, housings: [] }]);
  const [formData, setFormData] = useState({
    clientId: '',
    equipmentId: '',
    locationId: '',
    serviceTypeId: '',
    clientServiceOrderNumber: '',
    title: '',
    description: '',
    priority: 'medium',
    scheduledDate: '',
    assignedTechnicianId: ''
  });

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

  const openHousingsModalForService = (idx) => {
    const os = orderServices[idx];
    const count = Number(os.housingCount) || 0;
    if (!Number.isFinite(count) || count <= 0) {
      showWarning('Indique la cantidad de alojamientos antes de configurarlos.');
      return;
    }
    const existing = os.housings || [];
    const next = Array.from({ length: count }).map((_, i) => {
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
    nextServices[idx] = { ...nextServices[idx], housings: next };
    setOrderServices(nextServices);
    setEditingServiceIdx(idx);
    setShowHousingsModal(true);
  };

  const closeHousingsModal = (save = false) => {
    if (save && editingServiceIdx !== null) {
      const os = orderServices[editingServiceIdx];
      const housings = os.housings || [];
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
  };

  const updateHousing = (idx, field, value) => {
    const next = [...orderServices];
    const h = next[editingServiceIdx].housings || [];
    const hi = h[idx];
    if (hi) {
      h[idx] = { ...hi, [field]: value };
      next[editingServiceIdx] = { ...next[editingServiceIdx], housings: h };
      setOrderServices(next);
    }
  };

  const addService = () => {
    setOrderServices([...orderServices, { serviceId: '', housingCount: 0, housings: [] }]);
  };

  const removeService = (idx) => {
    setOrderServices(orderServices.filter((_, i) => i !== idx));
  };

  const updateService = (idx, field, value) => {
    const next = [...orderServices];
    next[idx] = { ...next[idx], [field]: value };
    if (field === 'housingCount') {
      const count = Number(value) || 0;
      if (count > 0) {
        const existing = next[idx].housings || [];
        const newHousings = Array.from({ length: count }).map((_, i) => {
          if (existing[i]) return existing[i];
          return {
            measureCode: numberToLetters(i + 1),
            description: '',
            nominalValue: '',
            nominalUnit: '',
            tolerance: ''
          };
        });
        next[idx] = { ...next[idx], housings: newHousings };
        setOrderServices(next);
        setEditingServiceIdx(idx);
        setShowHousingsModal(true);
      } else {
        next[idx] = { ...next[idx], housings: [] };
      }
    }
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
      const [clientsRes, servicesRes, techniciansRes, locationsRes, typesRes] = await Promise.all([
        api.get('/clients'),
        api.get('/services'),
        api.get('/technicians'),
        api.get('/locations'),
        api.get('/service-types')
      ]);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setTechnicians(techniciansRes.data);
      setLocations(locationsRes.data);
      setServiceTypes(typesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Servicios disponibles según el tipo seleccionado en la OT
  const servicesForOrder = formData.serviceTypeId
    ? services.filter((s) => String(s.service_type_id) === String(formData.serviceTypeId))
    : services;

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
          const housingCount = parseInt(s.housingCount) || 0;
          const housings = (s.housings || []).slice(0, housingCount);
          const hasMissing = housings.some(
            (h) => !h.measureCode || !h.description || (h.nominalValue !== '' && !h.nominalUnit)
          );
          if (housingCount > 0 && hasMissing) {
            throw new Error('Complete los alojamientos de cada servicio.');
          }
          return {
            serviceId: parseInt(s.serviceId),
            housingCount,
            housings: housings.map(h => ({
              measureCode: h.measureCode,
              description: h.description,
              nominalValue: h.nominalValue !== '' ? parseFloat(h.nominalValue) : null,
              nominalUnit: h.nominalValue !== '' ? (h.nominalUnit || null) : null,
              tolerance: h.tolerance || null
            }))
          };
        });

      if (servicesPayload.some(s => s.housingCount > 0 && s.housings.length !== s.housingCount)) {
        showWarning('Debe completar la información de los alojamientos de cada servicio.');
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
        scheduledDate: formData.scheduledDate || null,
        assignedTechnicianId: formData.assignedTechnicianId ? parseInt(formData.assignedTechnicianId) : null
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

  const currentHousings = editingServiceIdx !== null ? (orderServices[editingServiceIdx]?.housings || []) : [];
  let currentServiceName = 'Servicio';
  if (editingServiceIdx !== null && orderServices[editingServiceIdx]?.serviceId) {
    const svc = servicesForOrder.find(s => s.id === parseInt(orderServices[editingServiceIdx].serviceId));
    currentServiceName = svc?.name || 'Servicio';
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
              onChange={(e) => setFormData({ ...formData, serviceTypeId: e.target.value })}
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
              Agregue uno o más servicios. Para cada uno: seleccione el servicio, indique la cantidad de alojamientos y complete los datos.
            </p>
            {orderServices.map((os, idx) => (
              <div key={idx} className="service-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
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
                <div style={{ flex: '1 1 100px', minWidth: 100 }}>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Alojamientos</label>
                  <input
                    type="number"
                    min="0"
                    value={os.housingCount || ''}
                    onChange={(e) => updateService(idx, 'housingCount', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openHousingsModalForService(idx)}
                    title="Ver / Editar alojamientos"
                    style={{ padding: '8px 12px' }}
                  >
                    📋
                  </button>
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
            <label htmlFor="assignedTechnicianId">Técnico Asignado</label>
            <select
              id="assignedTechnicianId"
              value={formData.assignedTechnicianId}
              onChange={(e) => setFormData({ ...formData, assignedTechnicianId: e.target.value })}
            >
              <option value="">Sin asignar (se puede asignar después)</option>
              {technicians.map(tech => (
                <option key={tech.id} value={tech.id}>
                  {tech.full_name}
                </option>
              ))}
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

      {showHousingsModal && editingServiceIdx !== null && (
        <div className="modal-overlay" onClick={() => closeHousingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 750 }}>
            <h2>Alojamientos — {currentServiceName}</h2>
            <p style={{ marginTop: -8, color: '#6e6b7b' }}>
              Complete la información de cada alojamiento. Cada servicio comienza con A, B, C...
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
