import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { EditIcon, DeleteIcon, SearchIcon } from '../../components/Icons';
import './Management.css';

export default function Services() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    code: '', 
    name: '', 
    description: '', 
    category: '', 
    estimatedDuration: '', 
    standardPrice: '' 
  });
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await api.get('/services');
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
        standardPrice: formData.standardPrice ? parseFloat(formData.standardPrice) : null
      };

      await api.post('/services', data);
      
      setShowModal(false);
      setFormData({ code: '', name: '', description: '', category: '', estimatedDuration: '', standardPrice: '' });
      fetchServices();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar servicio');
    }
  };

  const handleEdit = (service) => {
    navigate(`/admin/services/${service.id}`);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de desactivar este servicio?')) {
      try {
        await api.delete(`/services/${id}`);
        fetchServices();
      } catch (error) {
        alert('Error al desactivar servicio');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({ code: '', name: '', description: '', category: '', estimatedDuration: '', standardPrice: '' });
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Servicios del Taller</h1>
      </div>

      <div className="table-header">
        <div className="table-filters">
          <div className="search-input-wrapper">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder="Buscar servicio..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {[...new Set(services.map(s => s.category).filter(Boolean))].map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="table-header-actions">
          <button onClick={() => setShowModal(true)} className="btn-primary">+ Nuevo Servicio</button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo Servicio</h2>
            <form onSubmit={handleSubmit}>
              <input 
                placeholder="Código (ej: SOLD-001)" 
                value={formData.code} 
                onChange={(e) => setFormData({...formData, code: e.target.value})} 
                required 
              />
              <input 
                placeholder="Nombre del Servicio" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                required 
              />
              <input 
                placeholder="Categoría (ej: Soldadura, Reparación)" 
                value={formData.category} 
                onChange={(e) => setFormData({...formData, category: e.target.value})} 
              />
              <input 
                type="number" 
                placeholder="Duración Estimada (horas)" 
                value={formData.estimatedDuration} 
                onChange={(e) => setFormData({...formData, estimatedDuration: e.target.value})} 
                min="0"
              />
              <input 
                type="number" 
                step="0.01"
                placeholder="Precio Estándar" 
                value={formData.standardPrice} 
                onChange={(e) => setFormData({...formData, standardPrice: e.target.value})} 
                min="0"
              />
              <textarea 
                placeholder="Descripción" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                rows="3"
              />
              <div className="modal-actions">
                <button type="button" onClick={handleCloseModal}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Acciones</th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Duración (h)</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            {services
              .filter(service => {
                if (categoryFilter && service.category !== categoryFilter) return false;
                if (!filter) return true;
                const search = filter.toLowerCase();
                return service.code?.toLowerCase().includes(search) ||
                       service.name?.toLowerCase().includes(search);
              })
              .map(service => (
              <tr key={service.id}>
                <td>
                  <div className="action-buttons">
                    <button 
                      onClick={() => handleEdit(service)} 
                      className="action-btn action-btn-edit"
                      title="Editar"
                    >
                      <EditIcon size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(service.id)} 
                      className="action-btn action-btn-delete"
                      title="Desactivar"
                    >
                      <DeleteIcon size={16} />
                    </button>
                  </div>
                </td>
                <td>{service.code}</td>
                <td>{service.name}</td>
                <td>{service.category || '-'}</td>
                <td>{service.estimated_duration || '-'}</td>
                <td>{service.standard_price ? `$${parseFloat(service.standard_price).toFixed(2)}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {services.length === 0 && (
        <div className="empty-state">
          <p>No hay servicios registrados</p>
        </div>
      )}
    </div>
  );
}

