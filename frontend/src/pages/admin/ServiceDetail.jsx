import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './ServiceDetail.css';

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    estimatedDuration: '',
    standardPrice: '',
    costPrice: '',
    laborCost: '',
    materialCost: ''
  });

  useEffect(() => {
    fetchService();
  }, [id]);

  const fetchService = async () => {
    try {
      const response = await api.get(`/services/${id}`);
      const serviceData = response.data;
      setService(serviceData);
      setFormData({
        code: serviceData.code || '',
        name: serviceData.name || '',
        description: serviceData.description || '',
        category: serviceData.category || '',
        estimatedDuration: serviceData.estimated_duration || '',
        standardPrice: serviceData.standard_price || '',
        costPrice: serviceData.cost_price || '',
        laborCost: serviceData.labor_cost || '',
        materialCost: serviceData.material_cost || ''
      });
    } catch (error) {
      console.error('Error fetching service:', error);
      alert('Error al cargar el servicio');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const data = {
        ...formData,
        estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
        standardPrice: formData.standardPrice ? parseFloat(formData.standardPrice) : null,
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
        laborCost: formData.laborCost ? parseFloat(formData.laborCost) : null,
        materialCost: formData.materialCost ? parseFloat(formData.materialCost) : null
      };

      await api.put(`/services/${id}`, data);
      setIsEditing(false);
      fetchService();
      alert('Servicio actualizado exitosamente');
    } catch (error) {
      console.error('Error updating service:', error);
      alert(error.response?.data?.error || 'Error al actualizar el servicio');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (service) {
      setFormData({
        code: service.code || '',
        name: service.name || '',
        description: service.description || '',
        category: service.category || '',
        estimatedDuration: service.estimated_duration || '',
        standardPrice: service.standard_price || '',
        costPrice: service.cost_price || '',
        laborCost: service.labor_cost || '',
        materialCost: service.material_cost || ''
      });
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      created: 'Creada',
      assigned: 'Asignada',
      in_progress: 'En Proceso',
      completed: 'Completada',
      accepted: 'Aceptada'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      created: '#9ca3af',
      assigned: '#3b82f6',
      in_progress: '#f59e0b',
      completed: '#10b981',
      accepted: '#8b5cf6'
    };
    return colors[status] || '#6b7280';
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!service) {
    return <div className="error">Servicio no encontrado</div>;
  }

  const profitMargin = formData.standardPrice && formData.costPrice
    ? ((parseFloat(formData.standardPrice) - parseFloat(formData.costPrice)) / parseFloat(formData.standardPrice) * 100).toFixed(2)
    : null;

  return (
    <div className="service-detail">
      <div className="detail-header">
        <button onClick={() => navigate('/admin/services')} className="btn-back">
          ← Volver
        </button>
        <div>
          <h1>{service.code}</h1>
          <p>{service.name}</p>
        </div>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="btn-primary">
            Editar
          </button>
        )}
      </div>

      <div className="detail-tabs">
        <button
          className={activeTab === 'general' ? 'active' : ''}
          onClick={() => setActiveTab('general')}
        >
          Información General
        </button>
        <button
          className={activeTab === 'financial' ? 'active' : ''}
          onClick={() => setActiveTab('financial')}
        >
          Datos Financieros
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Historial ({service.statistics?.totalOrders || 0})
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'general' && (
          <div className="details-section">
            {isEditing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>Código</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    disabled
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Nombre del Servicio *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Categoría</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-input"
                    placeholder="Ej: Soldadura, Reparación"
                  />
                </div>
                <div className="form-group">
                  <label>Duración Estimada (horas)</label>
                  <input
                    type="number"
                    value={formData.estimatedDuration}
                    onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                    min="0"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="5"
                    className="form-textarea"
                  />
                </div>
                <div className="form-actions">
                  <button onClick={handleCancel} className="btn-secondary">
                    Cancelar
                  </button>
                  <button onClick={handleSave} className="btn-primary">
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="info-grid">
                <div className="info-item">
                  <label>Código</label>
                  <p>{service.code}</p>
                </div>
                <div className="info-item">
                  <label>Nombre</label>
                  <p>{service.name}</p>
                </div>
                <div className="info-item">
                  <label>Categoría</label>
                  <p>{service.category || 'Sin categoría'}</p>
                </div>
                <div className="info-item">
                  <label>Duración Estimada</label>
                  <p>{service.estimated_duration ? `${service.estimated_duration} horas` : 'No especificada'}</p>
                </div>
                <div className="info-item full-width">
                  <label>Descripción</label>
                  <p>{service.description || 'Sin descripción'}</p>
                </div>
                <div className="info-item">
                  <label>Estado</label>
                  <p>
                    <span className={`status-badge ${service.is_active ? 'active' : 'inactive'}`}>
                      {service.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </p>
                </div>
                <div className="info-item">
                  <label>Fecha de Creación</label>
                  <p>{new Date(service.created_at).toLocaleString('es-PA')}</p>
                </div>
                <div className="info-item">
                  <label>Última Actualización</label>
                  <p>{new Date(service.updated_at).toLocaleString('es-PA')}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="financial-section">
            {isEditing ? (
              <div className="edit-form">
                <div className="financial-grid">
                  <div className="form-group">
                    <label>Precio Estándar (Venta) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.standardPrice}
                      onChange={(e) => setFormData({ ...formData, standardPrice: e.target.value })}
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Costo Total</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Costo de Mano de Obra</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.laborCost}
                      onChange={(e) => setFormData({ ...formData, laborCost: e.target.value })}
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Costo de Materiales</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.materialCost}
                      onChange={(e) => setFormData({ ...formData, materialCost: e.target.value })}
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {profitMargin !== null && (
                  <div className="profit-margin">
                    <label>Margen de Ganancia</label>
                    <p className={parseFloat(profitMargin) >= 0 ? 'positive' : 'negative'}>
                      {profitMargin}%
                    </p>
                  </div>
                )}
                <div className="form-actions">
                  <button onClick={handleCancel} className="btn-secondary">
                    Cancelar
                  </button>
                  <button onClick={handleSave} className="btn-primary">
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="financial-info">
                <div className="financial-grid">
                  <div className="financial-card">
                    <label>Precio Estándar (Venta)</label>
                    <p className="financial-value">
                      {service.standard_price ? `$${parseFloat(service.standard_price).toFixed(2)}` : 'No definido'}
                    </p>
                  </div>
                  <div className="financial-card">
                    <label>Costo Total</label>
                    <p className="financial-value">
                      {service.cost_price ? `$${parseFloat(service.cost_price).toFixed(2)}` : 'No definido'}
                    </p>
                  </div>
                  <div className="financial-card">
                    <label>Costo de Mano de Obra</label>
                    <p className="financial-value">
                      {service.labor_cost ? `$${parseFloat(service.labor_cost).toFixed(2)}` : 'No definido'}
                    </p>
                  </div>
                  <div className="financial-card">
                    <label>Costo de Materiales</label>
                    <p className="financial-value">
                      {service.material_cost ? `$${parseFloat(service.material_cost).toFixed(2)}` : 'No definido'}
                    </p>
                  </div>
                </div>
                {service.standard_price && service.cost_price && (
                  <div className="profit-margin-card">
                    <label>Margen de Ganancia</label>
                    <p className={`financial-value ${((parseFloat(service.standard_price) - parseFloat(service.cost_price)) / parseFloat(service.standard_price) * 100) >= 0 ? 'positive' : 'negative'}`}>
                      {((parseFloat(service.standard_price) - parseFloat(service.cost_price)) / parseFloat(service.standard_price) * 100).toFixed(2)}%
                    </p>
                  </div>
                )}
                {service.statistics && (
                  <div className="statistics-section">
                    <h3>Estadísticas Financieras</h3>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <label>Total de Órdenes</label>
                        <p>{service.statistics.totalOrders}</p>
                      </div>
                      <div className="stat-card">
                        <label>Órdenes Completadas</label>
                        <p>{service.statistics.completedOrders}</p>
                      </div>
                      <div className="stat-card">
                        <label>Ingresos Totales Estimados</label>
                        <p>${service.statistics.totalRevenue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            {service.history && service.history.length > 0 ? (
              <div className="history-list">
                <div className="history-header">
                  <h3>Órdenes de Trabajo que han usado este servicio</h3>
                  <p className="history-count">{service.history.length} orden(es) encontrada(s)</p>
                </div>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Número de Orden</th>
                      <th>Título</th>
                      <th>Cliente</th>
                      <th>Equipo</th>
                      <th>Técnico</th>
                      <th>Estado</th>
                      <th>Fecha de Creación</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {service.history.map(order => (
                      <tr key={order.id}>
                        <td>{order.order_number}</td>
                        <td>{order.title}</td>
                        <td>{order.client_name || order.company_name || '-'}</td>
                        <td>{order.equipment_name || '-'}</td>
                        <td>{order.technician_name || 'Sin asignar'}</td>
                        <td>
                          <span
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(order.status) }}
                          >
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td>{new Date(order.created_at).toLocaleDateString('es-PA')}</td>
                        <td>
                          <button
                            onClick={() => navigate(`/admin/work-orders/${order.id}`)}
                            className="btn-link"
                          >
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-message">
                <p>Este servicio aún no ha sido utilizado en ninguna orden de trabajo</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

