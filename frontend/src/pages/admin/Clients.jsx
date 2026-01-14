import { useState, useEffect } from 'react';
import api from '../../services/api';
import { EditIcon, SearchIcon } from '../../components/Icons';
import './Management.css';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', companyName: '', email: '', phone: '', address: '', contactPerson: '' });
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

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
      await api.post('/clients', formData);
      setShowModal(false);
      setFormData({ name: '', companyName: '', email: '', phone: '', address: '', contactPerson: '' });
      fetchClients();
    } catch (error) {
      alert('Error al crear cliente');
    }
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
          <button onClick={() => setShowModal(true)} className="btn-primary">+ Nuevo Cliente</button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo Cliente</h2>
            <form onSubmit={handleSubmit}>
              <input placeholder="Nombre" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              <input placeholder="Empresa" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} />
              <input placeholder="Email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              <input placeholder="Teléfono" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              <textarea placeholder="Dirección" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              <input placeholder="Persona de Contacto" value={formData.contactPerson} onChange={(e) => setFormData({...formData, contactPerson: e.target.value})} />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Cancelar</button>
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
              <th>Nombre</th>
              <th>Empresa</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Contacto</th>
            </tr>
          </thead>
          <tbody>
            {clients
              .filter(client => {
                if (!filter) return true;
                const search = filter.toLowerCase();
                return client.name?.toLowerCase().includes(search) ||
                       client.company_name?.toLowerCase().includes(search) ||
                       client.email?.toLowerCase().includes(search);
              })
              .map(client => (
              <tr key={client.id}>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn action-btn-edit" title="Editar">
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
    </div>
  );
}

