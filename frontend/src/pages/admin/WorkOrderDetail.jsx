import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getStaticUrl } from '../../config.js';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import './WorkOrderDetail.css';

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { alertDialog, showError, closeAlert } = useAlert();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/work-orders/${id}`);
      setOrder(response.data);
    } catch (error) {
      console.error('Error fetching work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.put(`/work-orders/${id}`, { status: newStatus });
      fetchOrder();
    } catch (error) {
      console.error('Error updating status:', error);
      showError('Error al actualizar el estado');
    }
  };

  const handleAssignTechnician = async (technicianId) => {
    try {
      await api.put(`/work-orders/${id}`, { assignedTechnicianId: technicianId });
      fetchOrder();
    } catch (error) {
      console.error('Error assigning technician:', error);
      showError('Error al asignar técnico');
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!order) {
    return <div className="error">Orden no encontrada</div>;
  }

  const initialMeasurements = order.measurements?.filter(m => m.measurement_type === 'initial') || [];
  const finalMeasurements = order.measurements?.filter(m => m.measurement_type === 'final') || [];

  return (
    <div className="work-order-detail">
      <div className="detail-header">
        <button onClick={() => navigate('/admin/work-orders')} className="btn-back">
          ← Volver
        </button>
        <div>
          <h1>{order.order_number}</h1>
          <p>{order.title}</p>
        </div>
      </div>

      <div className="detail-tabs">
        <button
          className={activeTab === 'details' ? 'active' : ''}
          onClick={() => setActiveTab('details')}
        >
          Detalles
        </button>
        <button
          className={activeTab === 'measurements' ? 'active' : ''}
          onClick={() => setActiveTab('measurements')}
        >
          Mediciones
        </button>
        <button
          className={activeTab === 'photos' ? 'active' : ''}
          onClick={() => setActiveTab('photos')}
        >
          Fotos
        </button>
        <button
          className={activeTab === 'observations' ? 'active' : ''}
          onClick={() => setActiveTab('observations')}
        >
          Observaciones
        </button>
        <button
          className={activeTab === 'documents' ? 'active' : ''}
          onClick={() => setActiveTab('documents')}
        >
          Documentos
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'details' && (
          <div className="details-section">
            <div className="info-grid">
              <div className="info-item">
                <label>Estado</label>
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="status-select"
                >
                  <option value="created">Creada</option>
                  <option value="assigned">Asignada</option>
                  <option value="in_progress">En Proceso</option>
                  <option value="completed">Completada</option>
                  <option value="accepted">Aceptada</option>
                </select>
              </div>

              <div className="info-item">
                <label>Cliente</label>
                <p>{order.client_name}</p>
              </div>

              <div className="info-item">
                <label>Equipo</label>
                <p>{order.equipment_name}</p>
              </div>

              <div className="info-item">
                <label>Ubicación del Servicio</label>
                <p>{order.service_location || 'No especificada'}</p>
              </div>

              <div className="info-item">
                <label>Técnico Asignado</label>
                <p>{order.technician_name || 'Sin asignar'}</p>
              </div>

              <div className="info-item">
                <label>Prioridad</label>
                <p>{order.priority === 'low' ? 'Baja' : 
                    order.priority === 'medium' ? 'Media' : 
                    order.priority === 'high' ? 'Alta' : 'Urgente'}</p>
              </div>

              <div className="info-item">
                <label>Fecha Programada</label>
                <p>{order.scheduled_date 
                  ? (() => {
                      try {
                        const dateStr = typeof order.scheduled_date === 'string' 
                          ? order.scheduled_date.split('T')[0]
                          : order.scheduled_date;
                        return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-PA', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        });
                      } catch (error) {
                        return order.scheduled_date;
                      }
                    })()
                  : 'No programada'}</p>
              </div>

              <div className="info-item">
                <label>Fecha de Inicio</label>
                <p>{order.start_date 
                  ? new Date(order.start_date).toLocaleString('es-PA')
                  : 'No iniciada'}</p>
              </div>

              <div className="info-item">
                <label>Fecha de Completación</label>
                <p>{order.completion_date 
                  ? new Date(order.completion_date).toLocaleString('es-PA')
                  : 'No completada'}</p>
              </div>

              <div className="info-item">
                <label>Fecha de Creación</label>
                <p>{new Date(order.created_at).toLocaleString('es-PA')}</p>
              </div>
            </div>

            <div className="description-section">
              <label>Descripción</label>
              <p>{order.description || 'Sin descripción'}</p>
            </div>
          </div>
        )}

        {activeTab === 'measurements' && (
          <div className="measurements-section">
            <h2>Mediciones Iniciales</h2>
            {initialMeasurements.length > 0 ? (
              <div className="measurements-list">
                {initialMeasurements.map(measurement => (
                  <div key={measurement.id} className="measurement-card">
                    <div className="measurement-header">
                      <span>{new Date(measurement.measurement_date).toLocaleString('es-PA')}</span>
                    </div>

                    {measurement.housing_measurements && measurement.housing_measurements.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Medida</th>
                              <th>Descripción</th>
                              <th>Nominal</th>
                              <th>X1</th>
                              <th>Y1</th>
                              <th>Unidad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {measurement.housing_measurements.map((hm) => (
                              <tr key={hm.housing_id}>
                                <td>{hm.measure_code}</td>
                                <td>{hm.housing_description || '-'}</td>
                                <td>{hm.nominal_value !== null && hm.nominal_value !== undefined ? `${hm.nominal_value} ${hm.nominal_unit || ''}` : '-'}</td>
                                <td>{hm.x1 ?? '-'}</td>
                                <td>{hm.y1 ?? '-'}</td>
                                <td>{hm.unit || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: 8 }}>
                          <strong>Observaciones:</strong> {measurement.notes || '-'}
                        </div>
                      </div>
                    ) : (
                      <div className="measurement-values">
                        {measurement.temperature && <div>Temperatura: {measurement.temperature}°C</div>}
                        {measurement.pressure && <div>Presión: {measurement.pressure}</div>}
                        {measurement.voltage && <div>Voltaje: {measurement.voltage}V</div>}
                        {measurement.current && <div>Corriente: {measurement.current}A</div>}
                        {measurement.resistance && <div>Resistencia: {measurement.resistance}Ω</div>}
                        <div style={{ marginTop: 8 }}>
                          <strong>Observaciones:</strong> {measurement.notes || '-'}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No hay mediciones iniciales</p>
            )}

            <h2>Mediciones Finales</h2>
            {finalMeasurements.length > 0 ? (
              <div className="measurements-list">
                {finalMeasurements.map(measurement => (
                  <div key={measurement.id} className="measurement-card">
                    <div className="measurement-header">
                      <span>{new Date(measurement.measurement_date).toLocaleString('es-PA')}</span>
                    </div>

                    {measurement.housing_measurements && measurement.housing_measurements.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Medida</th>
                              <th>Descripción</th>
                              <th>Nominal</th>
                              <th>X1</th>
                              <th>Y1</th>
                              <th>Unidad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {measurement.housing_measurements.map((hm) => (
                              <tr key={hm.housing_id}>
                                <td>{hm.measure_code}</td>
                                <td>{hm.housing_description || '-'}</td>
                                <td>{hm.nominal_value !== null && hm.nominal_value !== undefined ? `${hm.nominal_value} ${hm.nominal_unit || ''}` : '-'}</td>
                                <td>{hm.x1 ?? '-'}</td>
                                <td>{hm.y1 ?? '-'}</td>
                                <td>{hm.unit || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: 8 }}>
                          <strong>Observaciones:</strong> {measurement.notes || '-'}
                        </div>
                      </div>
                    ) : (
                      <div className="measurement-values">
                        {measurement.temperature && <div>Temperatura: {measurement.temperature}°C</div>}
                        {measurement.pressure && <div>Presión: {measurement.pressure}</div>}
                        {measurement.voltage && <div>Voltaje: {measurement.voltage}V</div>}
                        {measurement.current && <div>Corriente: {measurement.current}A</div>}
                        {measurement.resistance && <div>Resistencia: {measurement.resistance}Ω</div>}
                        <div style={{ marginTop: 8 }}>
                          <strong>Observaciones:</strong> {measurement.notes || '-'}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No hay mediciones finales</p>
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="photos-section">
            {order.photos && order.photos.length > 0 ? (
              <div className="photos-grid">
                {order.photos.map(photo => (
                  <div key={photo.id} className="photo-item">
                    <img src={getStaticUrl(photo.photo_path)} alt={photo.description || 'Foto'} />
                    <p>{photo.description || 'Sin descripción'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No hay fotos</p>
            )}
          </div>
        )}

        {activeTab === 'observations' && (
          <div className="observations-section">
            {order.observations && order.observations.length > 0 ? (
              <div className="observations-list">
                {order.observations.map(obs => (
                  <div key={obs.id} className="observation-card">
                    <div className="observation-header">
                      <span className="observation-type">{obs.observation_type}</span>
                      <span className="observation-date">
                        {new Date(obs.created_at).toLocaleString('es-PA')}
                      </span>
                    </div>
                    <p>{obs.observation}</p>
                    <span className="observation-author">Por: {obs.created_by_name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No hay observaciones</p>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="documents-section">
            {order.documents && order.documents.length > 0 ? (
              <>
                <div className="documents-list">
                  {order.documents.map(doc => {
                    const docTypeLabels = {
                      blueprint: '📐 Plano',
                      manual: '📖 Manual Técnico',
                      specification: '📋 Especificación',
                      other: '📄 Documento'
                    };
                    const docTypeLabel = docTypeLabels[doc.document_type] || '📄 Documento';
                    const isManual = doc.document_type === 'manual';
                    const isVisible = doc.is_visible_to_technician !== false; // Default true if not set
                    
                    return (
                      <div key={doc.id} className={`document-item ${isManual ? 'document-manual' : ''}`}>
                        <div className="document-checkbox">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={async (e) => {
                              try {
                                const currentPermissions = order.documents.map(d => ({
                                  documentId: d.id,
                                  isVisibleToTechnician: d.id === doc.id ? e.target.checked : (d.is_visible_to_technician !== false)
                                }));
                                await api.put(`/work-orders/${id}/documents/permissions`, {
                                  documentPermissions: currentPermissions
                                });
                                fetchOrder();
                              } catch (error) {
                                console.error('Error updating document permission:', error);
                                showError('Error al actualizar el permiso del documento');
                              }
                            }}
                            title="Visible para técnico"
                          />
                        </div>
                        <div className="document-info">
                          <a
                            href={getStaticUrl(doc.file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="document-link"
                          >
                            {docTypeLabel} {doc.file_name}
                          </a>
                          {doc.description && (
                            <p className="document-description">{doc.description}</p>
                          )}
                        </div>
                        <div className="document-meta">
                          <span className="document-size">{(doc.file_size / 1024).toFixed(2)} KB</span>
                          {doc.document_type && (
                            <span className="document-type-badge">
                              {doc.document_type === 'manual' ? 'Manual' :
                               doc.document_type === 'blueprint' ? 'Plano' :
                               doc.document_type === 'specification' ? 'Especificación' : 'Otro'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="documents-note">
                  <p>☑️ Marque los documentos que el técnico podrá ver en esta orden de trabajo</p>
                </div>
              </>
            ) : (
              <p className="empty-message">No hay documentos</p>
            )}
          </div>
        )}
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

