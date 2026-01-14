import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './Technician.css';

export default function TechnicianWorkOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

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

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="technician-work-orders">
      <h1>Mis Órdenes de Trabajo</h1>

      <div className="filter-tabs">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          Todas
        </button>
        <button
          className={filter === 'assigned' ? 'active' : ''}
          onClick={() => setFilter('assigned')}
        >
          Asignadas
        </button>
        <button
          className={filter === 'in_progress' ? 'active' : ''}
          onClick={() => setFilter('in_progress')}
        >
          En Proceso
        </button>
        <button
          className={filter === 'completed' ? 'active' : ''}
          onClick={() => setFilter('completed')}
        >
          Completadas
        </button>
      </div>

      <div className="orders-list">
        {filteredOrders.map(order => (
          <Link key={order.id} to={`/technician/work-orders/${order.id}`} className="order-card-link">
            <div className="order-card">
              <div className="order-header">
                <span className="order-number">{order.order_number}</span>
                <span className={`status-badge status-${order.status}`}>
                  {order.status === 'created' ? 'Creada' :
                   order.status === 'assigned' ? 'Asignada' :
                   order.status === 'in_progress' ? 'En Proceso' :
                   order.status === 'completed' ? 'Completada' : 'Aceptada'}
                </span>
              </div>
              <h3>{order.title}</h3>
              <p className="order-client">{order.client_name}</p>
              <p className="order-equipment">{order.equipment_name}</p>
              <p className="order-date">
                {new Date(order.created_at).toLocaleDateString('es-PA')}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="empty-state">
          <p>No tienes órdenes asignadas</p>
        </div>
      )}
    </div>
  );
}

