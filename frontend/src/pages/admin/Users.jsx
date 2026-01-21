import { useState, useEffect } from 'react';
import api from '../../services/api';
import { EditIcon, SearchIcon } from '../../components/Icons';
import './Management.css';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'technician',
    phone: '',
    isActive: true
  });
  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'edit' && editingUserId) {
        // Backend update endpoint does NOT accept username/password updates
        await api.put(`/users/${editingUserId}`, {
          email: formData.email,
          fullName: formData.fullName,
          role: formData.role,
          phone: formData.phone,
          isActive: formData.isActive
        });
      } else {
        await api.post('/users', {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          role: formData.role,
          phone: formData.phone
        });
      }
      setShowModal(false);
      setModalMode('create');
      setEditingUserId(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        fullName: '',
        role: 'technician',
        phone: '',
        isActive: true
      });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar usuario');
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingUserId(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      fullName: '',
      role: 'technician',
      phone: '',
      isActive: true
    });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setEditingUserId(user.id);
    setFormData({
      username: user.username || '',
      email: user.email || '',
      password: '',
      fullName: user.full_name || '',
      role: user.role || 'technician',
      phone: user.phone || '',
      isActive: user.is_active !== undefined ? !!user.is_active : true
    });
    setShowModal(true);
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Usuarios</h1>
      </div>

      <div className="table-header">
        <div className="table-filters">
          <div className="search-input-wrapper">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder="Buscar usuario..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="technician">Técnico</option>
          </select>
        </div>
        <div className="table-header-actions">
          <button onClick={openCreateModal} className="btn-primary">+ Nuevo Usuario</button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{modalMode === 'edit' ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            <form onSubmit={handleSubmit}>
              {modalMode === 'create' ? (
                <>
                  <input placeholder="Usuario" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required />
                  <input placeholder="Email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                  <input placeholder="Contraseña" type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required />
                  <input placeholder="Nombre Completo" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} required />
                </>
              ) : (
                <>
                  <input placeholder="Usuario" value={formData.username} disabled />
                  <input placeholder="Email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                  <input placeholder="Nombre Completo" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} required />
                </>
              )}
              <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                <option value="technician">Técnico</option>
                <option value="admin">Administrador</option>
              </select>
              <input placeholder="Teléfono" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
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
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter(user => {
                if (roleFilter && user.role !== roleFilter) return false;
                if (!filter) return true;
                const search = filter.toLowerCase();
                return user.username?.toLowerCase().includes(search) ||
                       user.full_name?.toLowerCase().includes(search) ||
                       user.email?.toLowerCase().includes(search);
              })
              .map(user => (
              <tr key={user.id}>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn action-btn-edit"
                      title="Editar"
                      onClick={() => openEditModal(user)}
                      type="button"
                    >
                      <EditIcon size={16} />
                    </button>
                  </div>
                </td>
                <td>{user.username}</td>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`badge ${user.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>
                    {user.role === 'admin' ? 'Administrador' : 'Técnico'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${user.is_active ? 'badge-green' : 'badge-gray'}`}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

