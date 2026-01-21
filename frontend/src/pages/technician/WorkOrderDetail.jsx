import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getStaticUrl } from '../../config.js';
import './Technician.css';

export default function TechnicianWorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [measurementData, setMeasurementData] = useState({ measurementType: 'initial', temperature: '', pressure: '', voltage: '', current: '', resistance: '', notes: '' });
  const [observationData, setObservationData] = useState({ observation: '', observationType: 'general' });

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
      alert('Error al actualizar el estado');
    }
  };

  const handleMeasurementSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/work-orders/${id}/measurements`, measurementData);
      setShowMeasurementModal(false);
      setMeasurementData({ measurementType: 'initial', temperature: '', pressure: '', voltage: '', current: '', resistance: '', notes: '' });
      fetchOrder();
    } catch (error) {
      alert('Error al guardar medición');
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
      alert('Error al subir foto');
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
      alert('Error al guardar observación');
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;
  if (!order) return <div className="error">Orden no encontrada</div>;

  const initialMeasurements = order.measurements?.filter(m => m.measurement_type === 'initial') || [];
  const finalMeasurements = order.measurements?.filter(m => m.measurement_type === 'final') || [];

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
                  <div className="measurement-values">
                    {m.temperature && <div>T: {m.temperature}°C</div>}
                    {m.pressure && <div>P: {m.pressure}</div>}
                    {m.voltage && <div>V: {m.voltage}V</div>}
                    {m.current && <div>I: {m.current}A</div>}
                    {m.resistance && <div>R: {m.resistance}Ω</div>}
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-message">No hay mediciones iniciales</p>
            )}

            <h3>Mediciones Finales</h3>
            {finalMeasurements.length > 0 ? (
              finalMeasurements.map(m => (
                <div key={m.id} className="measurement-card">
                  <div className="measurement-values">
                    {m.temperature && <div>T: {m.temperature}°C</div>}
                    {m.pressure && <div>P: {m.pressure}</div>}
                    {m.voltage && <div>V: {m.voltage}V</div>}
                    {m.current && <div>I: {m.current}A</div>}
                    {m.resistance && <div>R: {m.resistance}Ω</div>}
                  </div>
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
              <input type="number" placeholder="Temperatura (°C)" value={measurementData.temperature} onChange={(e) => setMeasurementData({...measurementData, temperature: e.target.value})} />
              <input type="number" placeholder="Presión" value={measurementData.pressure} onChange={(e) => setMeasurementData({...measurementData, pressure: e.target.value})} />
              <input type="number" placeholder="Voltaje (V)" value={measurementData.voltage} onChange={(e) => setMeasurementData({...measurementData, voltage: e.target.value})} />
              <input type="number" placeholder="Corriente (A)" value={measurementData.current} onChange={(e) => setMeasurementData({...measurementData, current: e.target.value})} />
              <input type="number" placeholder="Resistencia (Ω)" value={measurementData.resistance} onChange={(e) => setMeasurementData({...measurementData, resistance: e.target.value})} />
              <textarea placeholder="Notas" value={measurementData.notes} onChange={(e) => setMeasurementData({...measurementData, notes: e.target.value})} />
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

