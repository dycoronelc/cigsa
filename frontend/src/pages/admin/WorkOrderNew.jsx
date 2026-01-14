import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './WorkOrderNew.css';

export default function WorkOrderNew() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [formData, setFormData] = useState({
    clientId: '',
    equipmentId: '',
    serviceId: '',
    title: '',
    description: '',
    priority: 'medium',
    scheduledDate: '',
    assignedTechnicianId: ''
  });

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
      const response = await api.post('/work-orders', {
        clientId: parseInt(formData.clientId),
        equipmentId: parseInt(formData.equipmentId),
        serviceId: formData.serviceId ? parseInt(formData.serviceId) : null,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        scheduledDate: formData.scheduledDate || null,
        assignedTechnicianId: formData.assignedTechnicianId ? parseInt(formData.assignedTechnicianId) : null
      });

      alert('Orden de trabajo creada exitosamente');
      navigate(`/admin/work-orders/${response.data.id}`);
    } catch (error) {
      alert(error.response?.data?.error || 'Error al crear la orden de trabajo');
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
    </div>
  );
}

