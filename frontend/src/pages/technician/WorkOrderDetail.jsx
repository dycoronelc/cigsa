import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getStaticUrl } from '../../config.js';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import './Technician.css';

export default function TechnicianWorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { alertDialog, showError, closeAlert } = useAlert();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [measurementData, setMeasurementData] = useState({ measurementType: 'initial', notes: '', housingMeasurements: [] });
  const [observationData, setObservationData] = useState({ observation: '', observationType: 'general' });

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/work-orders/${id}`);
      setOrder(response.data);
      const housings = response.data?.service_housings || [];
      setMeasurementData((prev) => ({
        ...prev,
        housingMeasurements: housings.map((h) => ({
          housingId: h.id,
          x1: '',
          y1: '',
          unit: ''
        }))
      }));
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
      showError('Error al actualizar el estado');
    }
  };

  const handleMeasurementSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/work-orders/${id}/measurements`, measurementData);
      setShowMeasurementModal(false);
      const housings = order?.service_housings || [];
      setMeasurementData({
        measurementType: 'initial',
        notes: '',
        housingMeasurements: housings.map((h) => ({ housingId: h.id, x1: '', y1: '', unit: '' }))
      });
      fetchOrder();
    } catch (error) {
      showError('Error al guardar medición');
    }
  };

  const handlePhotoSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await api.post(`/work-orders/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowPhotoModal(false);
      fetchOrder();
    } catch (error) {
      showError('Error al subir foto');
    }
  };

  const handleObservationSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/work-orders/${id}/observations`, observationData);
      setShowObservationModal(false);
      setObservationData({ observation: '', observationType: 'general' });
      fetchOrder();
    } catch (error) {
      showError('Error al guardar observación');
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;
  if (!order) return <div className="error">Orden no encontrada</div>;

  const initialMeasurements = order.measurements?.filter(m => m.measurement_type === 'initial') || [];
  const finalMeasurements = order.measurements?.filter(m => m.measurement_type === 'final') || [];
  const serviceHousings = order.service_housings || [];

  // Calcular días trabajados
  const calculateWorkingDays = () => {
    if (!order.start_date) return null;
    
    const startDate = new Date(order.start_date);
    let endDate;
    
    if (order.status === 'completed' && order.completion_date) {
      endDate = new Date(order.completion_date);
    } else {
      endDate = new Date(); // Fecha actual
    }
    
    // Calcular diferencia en milisegundos y convertir a días
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const workingDays = calculateWorkingDays();

  return (
    <div className="technician-order-detail">
      <div className="detail-header">
        <button onClick={() => navigate('/technician/work-orders')} className="btn-back">
          ← Volver
        </button>
        <div>
          <h1>{order.order_number}</h1>
          <p>{order.title}</p>
        </div>
      </div>

      <div className="status-actions">
        {order.status === 'assigned' && (
          <button onClick={() => handleStatusChange('in_progress')} className="btn-primary">
            Iniciar Trabajo
          </button>
        )}
        {order.status === 'in_progress' && (
          <button onClick={() => handleStatusChange('completed')} className="btn-success">
            Completar Orden
          </button>
        )}
      </div>

      <div className="detail-tabs">
        <button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>
          Detalles
        </button>
        <button className={activeTab === 'measurements' ? 'active' : ''} onClick={() => setActiveTab('measurements')}>
          Mediciones
        </button>
        <button className={activeTab === 'photos' ? 'active' : ''} onClick={() => setActiveTab('photos')}>
          Fotos
        </button>
        <button className={activeTab === 'observations' ? 'active' : ''} onClick={() => setActiveTab('observations')}>
          Observaciones
        </button>
        <button className={activeTab === 'documents' ? 'active' : ''} onClick={() => setActiveTab('documents')}>
          Documentos
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'details' && (
          <div className="details-section">
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
            {workingDays !== null && (
              <div className="info-item">
                <label>Días Trabajados</label>
                <p style={{ fontWeight: 600, color: order.status === 'completed' ? '#4CAF50' : '#2196F3' }}>
                  {workingDays} {workingDays === 1 ? 'día' : 'días'}
                </p>
              </div>
            )}
            <div className="info-item">
              <label>Descripción</label>
              <p>{order.description || 'Sin descripción'}</p>
            </div>
          </div>
        )}

        {activeTab === 'measurements' && (
          <div className="measurements-section">
            <div className="section-actions">
              <button onClick={() => setShowMeasurementModal(true)} className="btn-primary">
                + Agregar Medición
              </button>
            </div>

            <h3>Mediciones Iniciales</h3>
            {initialMeasurements.length > 0 ? (
              initialMeasurements.map(m => (
                <div key={m.id} className="measurement-card">
                  {m.housing_measurements && m.housing_measurements.length > 0 ? (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>
                        {new Date(m.measurement_date).toLocaleString('es-PA')}
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                                <th>Medida</th>
                                <th>Descripción</th>
                                <th>Nominal</th>
                                <th>Tolerancia</th>
                                <th>X1</th>
                                <th>Y1</th>
                                <th>Unidad</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.housing_measurements.map((hm) => (
                                <tr key={hm.housing_id}>
                                  <td>{hm.measure_code}</td>
                                  <td>{hm.housing_description || '-'}</td>
                                  <td>{hm.nominal_value !== null && hm.nominal_value !== undefined ? `${hm.nominal_value} ${hm.nominal_unit || ''}` : '-'}</td>
                                  <td>{hm.tolerance || '-'}</td>
                                  <td>{hm.x1 ?? '-'}</td>
                                  <td>{hm.y1 ?? '-'}</td>
                                  <td>{hm.unit || '-'}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <strong>Observaciones:</strong> {m.notes || '-'}
                      </div>
                    </>
                  ) : (
                    <div className="measurement-values">
                      {/* compatibilidad con mediciones antiguas */}
                      {m.temperature && <div>T: {m.temperature}°C</div>}
                      {m.pressure && <div>P: {m.pressure}</div>}
                      {m.voltage && <div>V: {m.voltage}V</div>}
                      {m.current && <div>I: {m.current}A</div>}
                      {m.resistance && <div>R: {m.resistance}Ω</div>}
                      <div style={{ marginTop: 8 }}>
                        <strong>Observaciones:</strong> {m.notes || '-'}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-message">No hay mediciones iniciales</p>
            )}

            <h3>Mediciones Finales</h3>
            {finalMeasurements.length > 0 ? (
              finalMeasurements.map(m => (
                <div key={m.id} className="measurement-card">
                  {m.housing_measurements && m.housing_measurements.length > 0 ? (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>
                        {new Date(m.measurement_date).toLocaleString('es-PA')}
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                                <th>Medida</th>
                                <th>Descripción</th>
                                <th>Nominal</th>
                                <th>Tolerancia</th>
                                <th>X1</th>
                                <th>Y1</th>
                                <th>Unidad</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.housing_measurements.map((hm) => (
                                <tr key={hm.housing_id}>
                                  <td>{hm.measure_code}</td>
                                  <td>{hm.housing_description || '-'}</td>
                                  <td>{hm.nominal_value !== null && hm.nominal_value !== undefined ? `${hm.nominal_value} ${hm.nominal_unit || ''}` : '-'}</td>
                                  <td>{hm.tolerance || '-'}</td>
                                  <td>{hm.x1 ?? '-'}</td>
                                  <td>{hm.y1 ?? '-'}</td>
                                  <td>{hm.unit || '-'}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <strong>Observaciones:</strong> {m.notes || '-'}
                      </div>
                    </>
                  ) : (
                    <div className="measurement-values">
                      {/* compatibilidad con mediciones antiguas */}
                      {m.temperature && <div>T: {m.temperature}°C</div>}
                      {m.pressure && <div>P: {m.pressure}</div>}
                      {m.voltage && <div>V: {m.voltage}V</div>}
                      {m.current && <div>I: {m.current}A</div>}
                      {m.resistance && <div>R: {m.resistance}Ω</div>}
                      <div style={{ marginTop: 8 }}>
                        <strong>Observaciones:</strong> {m.notes || '-'}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-message">No hay mediciones finales</p>
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="photos-section">
            <div className="section-actions">
              <button onClick={() => setShowPhotoModal(true)} className="btn-primary">
                + Tomar Foto
              </button>
            </div>
            {order.photos && order.photos.length > 0 ? (
              <div className="photos-grid">
                {order.photos.map(photo => (
                  <div key={photo.id} className="photo-item">
                    <img src={getStaticUrl(photo.photo_path)} alt="Foto" />
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
            <div className="section-actions">
              <button onClick={() => setShowObservationModal(true)} className="btn-primary">
                + Agregar Observación
              </button>
            </div>
            {order.observations && order.observations.length > 0 ? (
              <div className="observations-list">
                {order.observations.map(obs => (
                  <div key={obs.id} className="observation-card">
                    <p>{obs.observation}</p>
                    <span className="observation-date">
                      {new Date(obs.created_at).toLocaleString('es-PA')}
                    </span>
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
                  
                  return (
                    <div key={doc.id} className={`document-item ${isManual ? 'document-manual' : ''}`}>
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
})}
              </div>
            ) : (
              <p className="empty-message">No hay documentos</p>
            )}
          </div>
        )}
      </div>

      {showMeasurementModal && (
        <div className="modal-overlay" onClick={() => setShowMeasurementModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Agregar Medición</h2>
            <form onSubmit={handleMeasurementSubmit}>
              <select
                value={measurementData.measurementType}
                onChange={(e) => setMeasurementData({...measurementData, measurementType: e.target.value})}
                required
              >
                <option value="initial">Medición Inicial</option>
                <option value="final">Medición Final</option>
              </select>

              {serviceHousings && serviceHousings.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Medida</th>
                        <th>Descripción</th>
                        <th>Nominal</th>
                        <th>Tolerancia</th>
                        <th>X1</th>
                        <th>Y1</th>
                        <th>Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceHousings.map((h, idx) => {
                        const row = measurementData.housingMeasurements?.find(r => r.housingId === h.id) || { housingId: h.id, x1: '', y1: '', unit: '' };
                        return (
                          <tr key={h.id}>
                            <td style={{ fontWeight: 700 }}>{h.measure_code}</td>
                            <td>{h.description || '-'}</td>
                            <td>{h.nominal_value !== null && h.nominal_value !== undefined ? `${h.nominal_value} ${h.nominal_unit || ''}` : '-'}</td>
                            <td>{h.tolerance || '-'}</td>
                            <td>
                              <input
                                type="number"
                                step="0.001"
                                value={row.x1}
                                onChange={(e) => {
                                  const next = measurementData.housingMeasurements.map(r => r.housingId === h.id ? { ...r, x1: e.target.value } : r);
                                  setMeasurementData({ ...measurementData, housingMeasurements: next });
                                }}
                                placeholder="0.000"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.001"
                                value={row.y1}
                                onChange={(e) => {
                                  const next = measurementData.housingMeasurements.map(r => r.housingId === h.id ? { ...r, y1: e.target.value } : r);
                                  setMeasurementData({ ...measurementData, housingMeasurements: next });
                                }}
                                placeholder="0.000"
                              />
                            </td>
                            <td>
                              <input
                                value={row.unit}
                                onChange={(e) => {
                                  const next = measurementData.housingMeasurements.map(r => r.housingId === h.id ? { ...r, unit: e.target.value } : r);
                                  setMeasurementData({ ...measurementData, housingMeasurements: next });
                                }}
                                placeholder="mm, in, etc."
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-message">Esta orden no tiene alojamientos configurados.</p>
              )}

              <textarea
                placeholder="Observaciones"
                value={measurementData.notes}
                onChange={(e) => setMeasurementData({ ...measurementData, notes: e.target.value })}
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowMeasurementModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPhotoModal && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Tomar Foto</h2>
            <form onSubmit={handlePhotoSubmit}>
              <input type="file" name="photo" accept="image/*" capture="environment" required />
              <select name="photoType">
                <option value="inspection">Inspección</option>
                <option value="during_service">Durante Servicio</option>
                <option value="completion">Finalización</option>
              </select>
              <textarea name="description" placeholder="Descripción (opcional)" />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowPhotoModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Subir</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showObservationModal && (
        <div className="modal-overlay" onClick={() => setShowObservationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Agregar Observación</h2>
            <form onSubmit={handleObservationSubmit}>
              <select
                value={observationData.observationType}
                onChange={(e) => setObservationData({...observationData, observationType: e.target.value})}
              >
                <option value="general">General</option>
                <option value="issue">Problema</option>
                <option value="solution">Solución</option>
                <option value="recommendation">Recomendación</option>
              </select>
              <textarea
                placeholder="Observación"
                value={observationData.observation}
                onChange={(e) => setObservationData({...observationData, observation: e.target.value})}
                required
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowObservationModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

