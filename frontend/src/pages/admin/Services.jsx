import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { EditIcon, DeleteIcon, SearchIcon } from '../../components/Icons';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import './Management.css';

export default function Services() {
  const navigate = useNavigate();
  const { alertDialog, showError, showConfirm, closeAlert } = useAlert();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    code: '', 
    name: '', 
    description: '', 
    categoryId: '', 
    estimatedDuration: '', 
    standardPrice: '' 
  });
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    fetchServicesAndCategories();
  }, []);

  const fetchServicesAndCategories = async () => {
    try {
      const [servicesRes, categoriesRes] = await Promise.all([
        api.get('/services'),
        api.get('/service-categories')
      ]);
      setServices(servicesRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceCategoryLabel = (service) => {
    return service.category_name || service.category || '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
        estimatedDuration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
        standardPrice: formData.standardPrice ? parseFloat(formData.standardPrice) : null
      };

      await api.post('/services', data);
      
      setShowModal(false);
      setFormData({ code: '', name: '', description: '', categoryId: '', estimatedDuration: '', standardPrice: '' });
      fetchServicesAndCategories();
    } catch (error) {
      showError(error.response?.data?.error || 'Error al guardar servicio');
    }
  };

  const handleEdit = (service) => {
    navigate(`/admin/services/${service.id}`);
  };

  const handleDelete = async (id) => {
    showConfirm('¿Está seguro de desactivar este servicio?', async () => {
      try {
        await api.delete(`/services/${id}`);
        fetchServicesAndCategories();
      } catch (error) {
        showError('Error al desactivar servicio');
      }
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({ code: '', name: '', description: '', categoryId: '', estimatedDuration: '', standardPrice: '' });
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
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
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
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">Seleccionar Categoría (Opcional)</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
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
                if (categoryFilter && getServiceCategoryLabel(service) !== categoryFilter) return false;
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
                <td>{getServiceCategoryLabel(service) || '-'}</td>
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

