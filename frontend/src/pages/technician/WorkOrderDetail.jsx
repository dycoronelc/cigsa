import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getStaticUrl } from '../../config.js';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import './Technician.css';

// Comprime una imagen en el navegador para subir más rápido (menor tamaño y tiempo)
function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, '.jpg') || 'photo.jpg';
          const compressed = new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function TechnicianWorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { alertDialog, showError, showSuccess, closeAlert } = useAlert();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoSource, setPhotoSource] = useState(null); // 'camera' | 'gallery' | null
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [measurementData, setMeasurementData] = useState({ measurementType: 'initial', notes: '', housingMeasurements: [] });
  const [observationData, setObservationData] = useState({ observation: '', observationType: 'general' });
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

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
    e?.preventDefault?.();
    const count = selectedPhotos.length;
    if (count === 0) return;
    const form = typeof e?.target?.photoType !== 'undefined' ? e.target : document.getElementById('photo-upload-form');
    const photoType = form?.photoType?.value || 'during_service';
    const description = form?.description?.value || '';
    try {
      const uploadPromises = selectedPhotos.map(async (file) => {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('photoType', photoType);
        formData.append('description', description);
        return api.post(`/work-orders/${id}/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      });
      await Promise.all(uploadPromises);
      setShowPhotoModal(false);
      setPhotoSource(null);
      setSelectedPhotos([]);
      fetchOrder();
      if (count > 1) {
        showSuccess(`${count} fotos subidas correctamente`);
      } else {
        showSuccess('Foto subida correctamente');
      }
    } catch (error) {
      showError('Error al subir foto(s)');
    }
  };

  // En móvil/tablet el input file debe dispararse por gesto directo del usuario (tap en botón)
  const handleCameraClick = () => {
    setPhotoSource('camera');
    setSelectedPhotos([]);
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    setPhotoSource('gallery');
    setSelectedPhotos([]);
    galleryInputRef.current?.click();
  };

  const handleCameraFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file);
      setSelectedPhotos([compressed]);
      setShowPhotoModal(true);
    }
    e.target.value = '';
  };

  const handleGalleryFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      setSelectedPhotos(compressed);
      setShowPhotoModal(true);
    }
    e.target.value = '';
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
            {/* Inputs ocultos: en móvil/tablet el gesto del usuario debe abrir cámara/galería directamente desde el botón */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraFileChange}
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryFileChange}
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
            />
            <div className="section-actions" style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={handleCameraClick} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
                Tomar Foto
              </button>
              <button type="button" onClick={handleGalleryClick} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Seleccionar de Galería
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

      {showPhotoModal && selectedPhotos.length > 0 && (
        <div className="modal-overlay" onClick={() => { setShowPhotoModal(false); setPhotoSource(null); setSelectedPhotos([]); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{photoSource === 'camera' ? 'Subir foto' : 'Subir fotos de galería'}</h2>
            <div style={{ marginBottom: '12px', padding: '12px', background: '#f5f5f5', borderRadius: '6px' }}>
              <strong>{selectedPhotos.length}</strong> foto(s) seleccionada(s)
            </div>
            <form id="photo-upload-form" onSubmit={handlePhotoSubmit}>
              <select name="photoType">
                <option value="inspection">Inspección</option>
                <option value="during_service">Durante Servicio</option>
                <option value="completion">Finalización</option>
              </select>
              <textarea name="description" placeholder="Descripción (opcional)" />
              <div className="modal-actions">
                <button type="button" onClick={() => { setShowPhotoModal(false); setPhotoSource(null); setSelectedPhotos([]); }}>Cancelar</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handlePhotoSubmit({ preventDefault: () => {}, target: document.getElementById('photo-upload-form') })}
                >
                  {selectedPhotos.length > 1 ? `Subir ${selectedPhotos.length} Fotos` : 'Subir'}
                </button>
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

