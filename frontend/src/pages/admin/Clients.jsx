import { useMemo, useState, useEffect } from 'react';
import api from '../../services/api';
import { EditIcon, SearchIcon } from '../../components/Icons';
import { useAlert } from '../../hooks/useAlert';
import { useSortableData } from '../../hooks/useSortableData';
import AlertDialog from '../../components/AlertDialog';
import './Management.css';

export default function Clients() {
  const { alertDialog, showError, closeAlert } = useAlert();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingClientId, setEditingClientId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    isActive: true
  });
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (!filter) return true;
      const search = filter.toLowerCase();
      return client.name?.toLowerCase().includes(search) ||
             client.company_name?.toLowerCase().includes(search) ||
             client.email?.toLowerCase().includes(search);
    });
  }, [clients, filter]);

  const { items: sortedClients, requestSort, getSortDirection } = useSortableData(filteredClients);

  const renderSortIndicator = (key) => {
    const dir = getSortDirection(key);
    if (!dir) return <span className="sort-indicator">↕</span>;
    return <span className="sort-indicator">{dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'edit' && editingClientId) {
        await api.put(`/clients/${editingClientId}`, {
          name: formData.name,
          companyName: formData.companyName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          contactPerson: formData.contactPerson,
          isActive: formData.isActive
        });
      } else {
        await api.post('/clients', {
          name: formData.name,
          companyName: formData.companyName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          contactPerson: formData.contactPerson
        });
      }
      setShowModal(false);
      setModalMode('create');
      setEditingClientId(null);
      setFormData({
        name: '',
        companyName: '',
        email: '',
        phone: '',
        address: '',
        contactPerson: '',
        isActive: true
      });
      fetchClients();
    } catch (error) {
      showError(error.response?.data?.error || 'Error al guardar cliente');
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingClientId(null);
    setFormData({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      address: '',
      contactPerson: '',
      isActive: true
    });
    setShowModal(true);
  };

  const openEditModal = (client) => {
    setModalMode('edit');
    setEditingClientId(client.id);
    setFormData({
      name: client.name || '',
      companyName: client.company_name || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      contactPerson: client.contact_person || '',
      isActive: client.is_active !== undefined ? !!client.is_active : true
    });
    setShowModal(true);
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Clientes</h1>
      </div>

      <div className="table-header">
        <div className="table-filters">
          <div className="search-input-wrapper">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="table-header-actions">
          <button onClick={openCreateModal} className="btn-primary">+ Nuevo Cliente</button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{modalMode === 'edit' ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            <form onSubmit={handleSubmit}>
              <input placeholder="Nombre" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              <input placeholder="Empresa" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} />
              <input placeholder="Email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              <input placeholder="Teléfono" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              <textarea placeholder="Dirección" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              <input placeholder="Persona de Contacto" value={formData.contactPerson} onChange={(e) => setFormData({...formData, contactPerson: e.target.value})} />
              {modalMode === 'edit' && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Activo
                </label>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Cancelar</button>
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
              <th className="sortable" onClick={() => requestSort('company_name')}>Empresa {renderSortIndicator('company_name')}</th>
              <th className="sortable" onClick={() => requestSort('email')}>Email {renderSortIndicator('email')}</th>
              <th className="sortable" onClick={() => requestSort('phone')}>Teléfono {renderSortIndicator('phone')}</th>
              <th className="sortable" onClick={() => requestSort('contact_person')}>Contacto {renderSortIndicator('contact_person')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedClients.map(client => (
              <tr key={client.id}>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn action-btn-edit"
                      title="Editar"
                      onClick={() => openEditModal(client)}
                      type="button"
                    >
                      <EditIcon size={16} />
                    </button>
                  </div>
                </td>
                <td>{client.name}</td>
                <td>{client.company_name || '-'}</td>
                <td>{client.email || '-'}</td>
                <td>{client.phone || '-'}</td>
                <td>{client.contact_person || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

