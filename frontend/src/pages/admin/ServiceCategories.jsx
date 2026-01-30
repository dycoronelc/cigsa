import { useEffect, useState } from 'react';
import api from '../../services/api';
import { EditIcon, DeleteIcon, SearchIcon } from '../../components/Icons';
import { useAlert } from '../../hooks/useAlert';
import { useSortableData } from '../../hooks/useSortableData';
import AlertDialog from '../../components/AlertDialog';
import './Management.css';

export default function ServiceCategories() {
  const { alertDialog, showError, showConfirm, closeAlert } = useAlert();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('');
  const [formData, setFormData] = useState({ name: '', description: '', isActive: true });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/service-categories');
      setCategories(res.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({ name: '', description: '', isActive: true });
    setShowModal(true);
  };

  const openEditModal = (cat) => {
    setModalMode('edit');
    setEditingId(cat.id);
    setFormData({
      name: cat.name || '',
      description: cat.description || '',
      isActive: cat.is_active !== undefined ? !!cat.is_active : true
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalMode('create');
    setEditingId(null);
    setFormData({ name: '', description: '', isActive: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'edit' && editingId) {
        await api.put(`/service-categories/${editingId}`, {
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive
        });
      } else {
        await api.post('/service-categories', {
          name: formData.name,
          description: formData.description
        });
      }
      closeModal();
      fetchCategories();
    } catch (error) {
      showError(error.response?.data?.error || 'Error al guardar categoría');
    }
  };

  const handleDelete = async (id) => {
    showConfirm('¿Está seguro de desactivar esta categoría?', async () => {
      try {
        await api.delete(`/service-categories/${id}`);
        fetchCategories();
      } catch (error) {
        showError(error.response?.data?.error || 'Error al desactivar categoría');
      }
    });
  };

  const filtered = categories.filter((c) => {
    if (!filter) return true;
    const s = filter.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.description?.toLowerCase().includes(s);
  });

  const { items: sortedCategories, requestSort, getSortDirection } = useSortableData(filtered);

  const renderSortIndicator = (key) => {
    const dir = getSortDirection(key);
    if (!dir) return <span className="sort-indicator">↕</span>;
    return <span className="sort-indicator">{dir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Categorías de Servicios</h1>
      </div>

      <div className="table-header">
        <div className="table-filters">
          <div className="search-input-wrapper">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder="Buscar categoría..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="table-header-actions">
          <button onClick={openCreateModal} className="btn-primary">+ Nueva Categoría</button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{modalMode === 'edit' ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
            <form onSubmit={handleSubmit}>
              <input
                placeholder="Nombre *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <textarea
                placeholder="Descripción"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
              />
              {modalMode === 'edit' && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Activo
                </label>
              )}
              <div className="modal-actions">
                <button type="button" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn-primary">
                  {modalMode === 'edit' ? 'Guardar Cambios' : 'Guardar'}
                </button>
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
              <th className="sortable" onClick={() => requestSort('name')}>Nombre {renderSortIndicator('name')}</th>
              <th className="sortable" onClick={() => requestSort('description')}>Descripción {renderSortIndicator('description')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedCategories.map((cat) => (
              <tr key={cat.id}>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="action-btn action-btn-edit"
                      title="Editar"
                      type="button"
                    >
                      <EditIcon size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="action-btn action-btn-delete"
                      title="Desactivar"
                      type="button"
                    >
                      <DeleteIcon size={16} />
                    </button>
                  </div>
                </td>
                <td>{cat.name}</td>
                <td>{cat.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {categories.length === 0 && (
        <div className="empty-state">
          <p>No hay categorías registradas</p>
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

