import { useEffect, useState } from 'react';
import api from '../../services/api';
import { EditIcon, DeleteIcon, SearchIcon } from '../../components/Icons';
import { useAlert } from '../../hooks/useAlert';
import { useSortableData } from '../../hooks/useSortableData';
import AlertDialog from '../../components/AlertDialog';
import './Management.css';

export default function Locations() {
  const { alertDialog, showError, showConfirm, closeAlert } = useAlert();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('');
  const [formData, setFormData] = useState({ name: '', isActive: true });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await api.get('/locations');
      setItems(res.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({ name: '', isActive: true });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setModalMode('edit');
    setEditingId(item.id);
    setFormData({
      name: item.name || '',
      isActive: item.is_active !== undefined ? !!item.is_active : true
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalMode('create');
    setEditingId(null);
    setFormData({ name: '', isActive: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'edit' && editingId) {
        await api.put(`/locations/${editingId}`, {
          name: formData.name,
          isActive: formData.isActive
        });
      } else {
        await api.post('/locations', { name: formData.name });
      }
      closeModal();
      fetchItems();
    } catch (error) {
      showError(error.response?.data?.error || 'Error al guardar ubicación');
    }
  };

  const handleDelete = async (id) => {
    showConfirm('¿Está seguro de desactivar esta ubicación?', async () => {
      try {
        await api.delete(`/locations/${id}`);
        fetchItems();
      } catch (error) {
        showError(error.response?.data?.error || 'Error al desactivar');
      }
    });
  };

  const filtered = items.filter((c) => {
    if (!filter) return true;
    return c.name?.toLowerCase().includes(filter.toLowerCase());
  });

  const { items: sortedItems, requestSort, getSortDirection } = useSortableData(filtered);

  const renderSortIndicator = (key) => {
    const dir = getSortDirection(key);
    if (!dir) return <span className="sort-indicator">↕</span>;
    return <span className="sort-indicator">{dir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Ubicaciones</h1>
      </div>

      <div className="table-header">
        <div className="table-filters">
          <div className="search-input-wrapper">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder="Buscar ubicación..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="table-header-actions">
          <button onClick={openCreateModal} className="btn-primary">+ Nueva Ubicación</button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{modalMode === 'edit' ? 'Editar Ubicación' : 'Nueva Ubicación'}</h2>
            <form onSubmit={handleSubmit}>
              <input
                placeholder="Nombre *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
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
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => openEditModal(item)}
                      className="action-btn action-btn-edit"
                      title="Editar"
                      type="button"
                    >
                      <EditIcon size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="action-btn action-btn-delete"
                      title="Desactivar"
                      type="button"
                    >
                      <DeleteIcon size={16} />
                    </button>
                  </div>
                </td>
                <td>{item.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          <p>No hay ubicaciones registradas</p>
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
