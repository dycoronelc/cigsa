import { useState, useEffect } from 'react';
import api from '../../services/api';
import './Dashboard.css';

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKPIs();
  }, []);

  const fetchKPIs = async () => {
    try {
      const response = await api.get('/dashboard/kpis');
      setKpis(response.data);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!kpis) {
    return <div className="error">Error al cargar los datos</div>;
  }

  const statusLabels = {
    created: 'Creadas',
    assigned: 'Asignadas',
    in_progress: 'En Proceso',
    completed: 'Completadas',
    accepted: 'Aceptadas'
  };

  const priorityLabels = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente'
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total de Órdenes</div>
          <div className="kpi-value">{kpis.totalOrders}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Completadas este Mes</div>
          <div className="kpi-value">{kpis.completedThisMonth}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Tiempo Promedio (horas)</div>
          <div className="kpi-value">{Math.round(kpis.avgCompletionHours || 0)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Listas para Facturar</div>
          <div className="kpi-value">{kpis.financial?.ready_to_invoice || 0}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Total Equipos</div>
          <div className="kpi-value">{kpis.equipment?.total_equipment || 0}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Marcas</div>
          <div className="kpi-value">{kpis.equipment?.total_brands || 0}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Modelos</div>
          <div className="kpi-value">{kpis.equipment?.total_models || 0}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Técnicos Activos</div>
          <div className="kpi-value">{kpis.technicians?.active_technicians || 0}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Servicios Activos</div>
          <div className="kpi-value">{kpis.services?.active_services || 0}</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h2>Órdenes por Estado</h2>
          <div className="status-list">
            {Object.entries(kpis.ordersByStatus || {}).map(([status, count]) => (
              <div key={status} className="status-item">
                <span className="status-label">{statusLabels[status] || status}</span>
                <span className="status-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card">
          <h2>Órdenes por Prioridad</h2>
          <div className="priority-list">
            {Object.entries(kpis.ordersByPriority || {}).map(([priority, count]) => (
              <div key={priority} className="priority-item">
                <span className="priority-label">{priorityLabels[priority] || priority}</span>
                <span className="priority-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-card">
        <h2>Productividad de Técnicos</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Técnico</th>
                <th>Total</th>
                <th>Completadas</th>
                <th>Aceptadas</th>
                <th>Promedio (horas)</th>
              </tr>
            </thead>
            <tbody>
              {kpis.technicianProductivity?.map((tech) => (
                <tr key={tech.id}>
                  <td>{tech.full_name}</td>
                  <td>{tech.total_orders}</td>
                  <td>{tech.completed}</td>
                  <td>{tech.accepted}</td>
                  <td>{Math.round(tech.avg_completion_hours || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-card">
        <h2>Actividad Reciente</h2>
        <div className="activity-list">
          {kpis.recentActivity?.slice(0, 10).map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-header">
                <span className="activity-user">{activity.user_name || 'Sistema'}</span>
                <span className="activity-time">
                  {new Date(activity.created_at).toLocaleString('es-PA')}
                </span>
              </div>
              <div className="activity-description">{activity.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

