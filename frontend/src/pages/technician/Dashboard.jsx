import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './Technician.css';

export default function TechnicianDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.get(`/dashboard/technician/${user.id}`);
      setStats(response.data.stats);
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="technician-dashboard">
      <h1>Mi Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats?.total || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Asignadas</div>
          <div className="stat-value">{stats?.assigned || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En Proceso</div>
          <div className="stat-value">{stats?.in_progress || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completadas</div>
          <div className="stat-value">{stats?.completed || 0}</div>
        </div>
      </div>

      <div className="orders-section">
        <h2>Órdenes Recientes</h2>
        <div className="orders-list">
          {orders.slice(0, 5).map(order => (
            <div 
              key={order.id} 
              className="order-card clickable"
              onClick={() => navigate(`/technician/work-orders/${order.id}`)}
            >
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
              <p className="order-client">{order.client_name} - {order.equipment_name}</p>
              <div className="order-footer">
                <span className="btn-view">Ver Detalles →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

