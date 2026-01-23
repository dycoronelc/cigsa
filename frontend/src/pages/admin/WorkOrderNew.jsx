import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import './WorkOrderNew.css';

export default function WorkOrderNew() {
  const navigate = useNavigate();
  const { alertDialog, showError, showSuccess, showWarning, closeAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [showHousingsModal, setShowHousingsModal] = useState(false);
  const [serviceHousings, setServiceHousings] = useState([]);
  const [formData, setFormData] = useState({
    clientId: '',
    equipmentId: '',
    serviceId: '',
    serviceLocation: '',
    serviceHousingCount: '',
    title: '',
    description: '',
    priority: 'medium',
    scheduledDate: '',
    assignedTechnicianId: ''
  });

  const numberToLetters = (n) => {
    // 1 -> A, 2 -> B, ... 26 -> Z, 27 -> AA
    let num = n;
    let s = '';
    while (num > 0) {
      const mod = (num - 1) % 26;
      s = String.fromCharCode(65 + mod) + s;
      num = Math.floor((num - 1) / 26);
    }
    return s;
  };

  const openHousingsModalForCount = (count) => {
    const c = Number(count);
    if (!Number.isFinite(c) || c <= 0) {
      setServiceHousings([]);
      setShowHousingsModal(false);
      return;
    }
    const next = Array.from({ length: c }).map((_, idx) => ({
      measureCode: numberToLetters(idx + 1),
      description: '',
      nominalValue: '',
      nominalUnit: '',
      tolerance: ''
    }));
    setServiceHousings(next);
    setShowHousingsModal(true);
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
      const [clientsRes, servicesRes, techniciansRes] = await Promise.all([
        api.get('/clients'),
        api.get('/services'),
        api.get('/technicians')
      ]);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setTechnicians(techniciansRes.data);
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
      const count = formData.serviceHousingCount ? parseInt(formData.serviceHousingCount) : 0;
      if (count > 0) {
        if (!serviceHousings || serviceHousings.length !== count) {
          showWarning('Debe completar la información de los alojamientos antes de crear la orden.');
          setLoading(false);
          return;
        }
        const hasMissing = serviceHousings.some(h => !h.measureCode || !h.description || h.nominalValue === '' || !h.nominalUnit);
        if (hasMissing) {
          showWarning('Complete Medida, Descripción, Medida Nominal y Unidad para cada alojamiento.');
          setLoading(false);
          return;
        }
      }

      const response = await api.post('/work-orders', {
        clientId: parseInt(formData.clientId),
        equipmentId: parseInt(formData.equipmentId),
        serviceId: formData.serviceId ? parseInt(formData.serviceId) : null,
        serviceLocation: formData.serviceLocation || null,
        serviceHousings: (parseInt(formData.serviceHousingCount) > 0) ? serviceHousings.map(h => ({
          measureCode: h.measureCode,
          description: h.description,
          nominalValue: h.nominalValue !== '' ? parseFloat(h.nominalValue) : null,
          nominalUnit: h.nominalUnit,
          tolerance: h.tolerance || null
        })) : [],
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
      showError(error.response?.data?.error || 'Error al crear la orden de trabajo');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceChange = (serviceId) => {
    if (serviceId) {
      const selectedService = services.find(s => s.id === parseInt(serviceId));
      if (selectedService && !formData.title) {
        setFormData({
          ...formData,
          serviceId: serviceId,
          title: selectedService.name
        });
      } else {
        setFormData({ ...formData, serviceId: serviceId });
      }
    } else {
      setFormData({ ...formData, serviceId: '' });
    }
  };

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
            <select
              id="equipmentId"
              value={formData.equipmentId}
              onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
              required
              disabled={!formData.clientId}
            >
              <option value="">{formData.clientId ? 'Seleccionar Equipo' : 'Primero seleccione un cliente'}</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.brand_name} {eq.model_name} - {eq.serial_number} {eq.client_name ? `(${eq.client_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="serviceId">Servicio</label>
            <select
              id="serviceId"
              value={formData.serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
            >
              <option value="">Seleccionar Servicio (Opcional)</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.code} - {service.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="serviceLocation">Ubicación del Servicio</label>
            <input
              type="text"
              id="serviceLocation"
              value={formData.serviceLocation}
              onChange={(e) => setFormData({ ...formData, serviceLocation: e.target.value })}
              placeholder="Ej: Planta 1, Área X, Taller, etc."
            />
          </div>

          <div className="form-group">
            <label htmlFor="serviceHousingCount">Cantidad de Alojamientos a intervenir</label>
            <input
              type="number"
              id="serviceHousingCount"
              min="0"
              value={formData.serviceHousingCount}
              onChange={(e) => {
                const v = e.target.value;
                setFormData({ ...formData, serviceHousingCount: v });
                if (v && parseInt(v) > 0) {
                  openHousingsModalForCount(v);
                } else {
                  setServiceHousings([]);
                }
              }}
              placeholder="0"
            />
            {parseInt(formData.serviceHousingCount) > 0 && (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 8 }}
                onClick={() => setShowHousingsModal(true)}
              >
                Configurar Alojamientos
              </button>
            )}
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

      {showHousingsModal && (
        <div className="modal-overlay" onClick={() => setShowHousingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 750 }}>
            <h2>Alojamientos del Servicio</h2>
            <p style={{ marginTop: -8, color: '#6e6b7b' }}>
              Complete la información de cada alojamiento. La “Medida” es automática (A, B, C...).
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
                  {serviceHousings.map((h, idx) => (
                    <tr key={h.measureCode}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{h.measureCode}</td>
                      <td>
                        <input
                          value={h.description}
                          onChange={(e) => {
                            const next = [...serviceHousings];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setServiceHousings(next);
                          }}
                          placeholder="Descripción del alojamiento"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.001"
                          value={h.nominalValue}
                          onChange={(e) => {
                            const next = [...serviceHousings];
                            next[idx] = { ...next[idx], nominalValue: e.target.value };
                            setServiceHousings(next);
                          }}
                          placeholder="0.000"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={h.tolerance}
                          onChange={(e) => {
                            const next = [...serviceHousings];
                            next[idx] = { ...next[idx], tolerance: e.target.value };
                            setServiceHousings(next);
                          }}
                          placeholder="+0.5, -0.3, ±0.2"
                          pattern="[+\-±]?[0-9]*\.?[0-9]*"
                        />
                      </td>
                      <td>
                        <input
                          value={h.nominalUnit}
                          onChange={(e) => {
                            const next = [...serviceHousings];
                            next[idx] = { ...next[idx], nominalUnit: e.target.value };
                            setServiceHousings(next);
                          }}
                          placeholder="mm, in, etc."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowHousingsModal(false)}>Cerrar</button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const count = parseInt(formData.serviceHousingCount) || 0;
                  if (count > 0 && serviceHousings.length !== count) {
                    showWarning('Cantidad de alojamientos no coincide.');
                    return;
                  }
                  const hasMissing = serviceHousings.some(h => !h.measureCode || !h.description || h.nominalValue === '' || !h.nominalUnit);
                  if (hasMissing) {
                    showWarning('Complete Descripción, Medida Nominal y Unidad para cada alojamiento.');
                    return;
                  }
                  setShowHousingsModal(false);
                }}
              >
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

