import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSortableData } from '../../hooks/useSortableData';
import './Management.css';

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await api.get('/dashboard/activity-log');
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Error fetching activity log:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;

  const { items: sortedLogs, requestSort, getSortDirection } = useSortableData(logs);

  const renderSortIndicator = (key) => {
    const dir = getSortDirection(key);
    if (!dir) return <span className="sort-indicator">↕</span>;
    return <span className="sort-indicator">{dir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Bitácora de Actividad</h1>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => requestSort('created_at', (l) => new Date(l.created_at))}>Fecha {renderSortIndicator('created_at')}</th>
              <th className="sortable" onClick={() => requestSort('user_name')}>Usuario {renderSortIndicator('user_name')}</th>
              <th className="sortable" onClick={() => requestSort('action')}>Acción {renderSortIndicator('action')}</th>
              <th className="sortable" onClick={() => requestSort('entity_type')}>Entidad {renderSortIndicator('entity_type')}</th>
              <th className="sortable" onClick={() => requestSort('description')}>Descripción {renderSortIndicator('description')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedLogs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString('es-PA')}</td>
                <td>{log.user_name || 'Sistema'}</td>
                <td>{log.action}</td>
                <td>{log.entity_type}</td>
                <td>{log.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

