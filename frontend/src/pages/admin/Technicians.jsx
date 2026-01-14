import { useState, useEffect } from 'react';
import api from '../../services/api';
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
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Email</th>
              <th>Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {technicians.map(tech => (
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

