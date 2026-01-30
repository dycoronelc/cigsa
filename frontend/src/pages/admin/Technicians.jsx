import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSortableData } from '../../hooks/useSortableData';
import './Management.css';

export default function Technicians() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      const response = await api.get('/technicians');
      setTechnicians(response.data);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    } finally {
      setLoading(false);
    }
  };

  const { items: sortedTechnicians, requestSort, getSortDirection } = useSortableData(technicians);

  const renderSortIndicator = (key) => {
    const dir = getSortDirection(key);
    if (!dir) return <span className="sort-indicator">↕</span>;
    return <span className="sort-indicator">{dir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Técnicos</h1>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => requestSort('full_name')}>Nombre {renderSortIndicator('full_name')}</th>
              <th className="sortable" onClick={() => requestSort('username')}>Usuario {renderSortIndicator('username')}</th>
              <th className="sortable" onClick={() => requestSort('email')}>Email {renderSortIndicator('email')}</th>
              <th className="sortable" onClick={() => requestSort('phone')}>Teléfono {renderSortIndicator('phone')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedTechnicians.map(tech => (
              <tr key={tech.id}>
                <td>{tech.full_name}</td>
                <td>{tech.username}</td>
                <td>{tech.email}</td>
                <td>{tech.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

