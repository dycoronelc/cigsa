import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { ViewIcon } from '../../components/Icons';
import { useSortableData } from '../../hooks/useSortableData';
import './WorkOrders.css';

export default function WorkOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '' });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/work-orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      created: { label: 'Creada', class: 'badge-gray' },
      assigned: { label: 'Asignada', class: 'badge-blue' },
      in_progress: { label: 'En Proceso', class: 'badge-yellow' },
      completed: { label: 'Completada', class: 'badge-green' },
      accepted: { label: 'Aceptada', class: 'badge-purple' },
      on_hold: { label: 'En Espera', class: 'badge-gray' },
      cancelled: { label: 'Cancelada', class: 'badge-red' }
    };
    return badges[status] || { label: status, class: 'badge-gray' };
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      low: { label: 'Baja', class: 'badge-gray' },
      medium: { label: 'Media', class: 'badge-blue' },
      high: { label: 'Alta', class: 'badge-yellow' },
      urgent: { label: 'Urgente', class: 'badge-red' }
    };
    return badges[priority] || { label: priority, class: 'badge-gray' };
  };

  const filteredOrders = orders.filter(order => {
    if (filter.status && order.status !== filter.status) return false;
    if (filter.priority && order.priority !== filter.priority) return false;
    return true;
  });

  const { items: sortedOrders, requestSort, getSortDirection } = useSortableData(filteredOrders);

  const renderSortIndicator = (key) => {
    const dir = getSortDirection(key);
    if (!dir) return <span className="sort-indicator">↕</span>;
    return <span className="sort-indicator">{dir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div className="work-orders">
      <div className="page-header">
        <h1>Órdenes de Trabajo</h1>
      </div>

      <div className="table-header">
        <div className="table-filters">
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">Todos los estados</option>
            <option value="created">Creada</option>
            <option value="assigned">Asignada</option>
            <option value="in_progress">En Proceso</option>
            <option value="completed">Completada</option>
            <option value="accepted">Aceptada</option>
            <option value="on_hold">En Espera</option>
            <option value="cancelled">Cancelada</option>
          </select>

          <select
            value={filter.priority}
            onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
          >
            <option value="">Todas las prioridades</option>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
        <div className="table-header-actions">
          <Link to="/admin/work-orders/new" className="btn-primary">
            + Nueva Orden
          </Link>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Acciones</th>
              <th className="sortable" onClick={() => requestSort('order_number')}>Número {renderSortIndicator('order_number')}</th>
              <th className="sortable" onClick={() => requestSort('title')}>Título {renderSortIndicator('title')}</th>
              <th className="sortable" onClick={() => requestSort('client_name')}>Cliente {renderSortIndicator('client_name')}</th>
              <th className="sortable" onClick={() => requestSort('equipment_name')}>Equipo {renderSortIndicator('equipment_name')}</th>
              <th className="sortable" onClick={() => requestSort('technician_name')}>Técnico {renderSortIndicator('technician_name')}</th>
              <th className="sortable" onClick={() => requestSort('client_service_order_number')}>N° OS Cliente {renderSortIndicator('client_service_order_number')}</th>
              <th className="sortable" onClick={() => requestSort('status')}>Estado {renderSortIndicator('status')}</th>
              <th className="sortable" onClick={() => requestSort('priority')}>Prioridad {renderSortIndicator('priority')}</th>
              <th className="sortable" onClick={() => requestSort('created_at', (o) => new Date(o.created_at))}>Fecha {renderSortIndicator('created_at')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map(order => {
              const statusBadge = getStatusBadge(order.status);
              const priorityBadge = getPriorityBadge(order.priority);
              
              return (
                <tr key={order.id}>
                  <td>
                    <div className="action-buttons">
                      <Link
                        to={`/admin/work-orders/${order.id}`}
                        className="action-btn action-btn-view"
                        title="Ver detalles"
                      >
                        <ViewIcon size={16} />
                      </Link>
                    </div>
                  </td>
                  <td>{order.order_number}</td>
                  <td>{order.title}</td>
                  <td>{order.client_name}</td>
                  <td>{order.equipment_name}</td>
                  <td>{order.technician_name || <span className="badge badge-gray">Sin asignar</span>}</td>
                  <td>{order.client_service_order_number || '-'}</td>
                  <td>
                    <span className={`badge ${statusBadge.class}`}>
                      {statusBadge.label}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${priorityBadge.class}`}>
                      {priorityBadge.label}
                    </span>
                  </td>
                  <td>{new Date(order.created_at).toLocaleDateString('es-PA')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredOrders.length === 0 && (
        <div className="empty-state">
          <p>No se encontraron órdenes de trabajo</p>
        </div>
      )}
    </div>
  );
}

