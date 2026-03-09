import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getStaticUrl } from '../../config.js';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import SearchableSelect from '../../components/SearchableSelect';
import './WorkOrderDetail.css';

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { alertDialog, showError, showSuccess, showConfirm, closeAlert } = useAlert();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    equipmentId: '',
    serviceLocation: '',
    clientServiceOrderNumber: '',
    priority: 'medium',
    scheduledDate: '',
    assignedTechnicianId: '',
    services: [],
    description: ''
  });
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [showHousingsModal, setShowHousingsModal] = useState(false);
  const [editingServiceIdx, setEditingServiceIdx] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showEditMeasurementModal, setShowEditMeasurementModal] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState(null);
  const [editMeasurementForm, setEditMeasurementForm] = useState({ notes: '', housingMeasurements: [] });
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const isDocVisibleToTechnician = (d) => {
    const v = d?.is_visible_to_technician;
    // backend may return TRUE/FALSE, 1/0, or null/undefined (treat as visible by default)
    if (v === undefined || v === null) return true;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v === 1;
    if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
    return Boolean(v);
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  useEffect(() => {
    const fetchEquipmentByClient = async () => {
      if (!order?.client_id) return;
      try {
        const res = await api.get(`/equipment?clientId=${order.client_id}`);
        setEquipmentOptions(res.data || []);
      } catch (error) {
        console.error('Error fetching equipment for client:', error);
        setEquipmentOptions([]);
      }
    };
    fetchEquipmentByClient();
  }, [order?.client_id]);

  useEffect(() => {
    // lookups for editable selects
    const fetchLookups = async () => {
      try {
        const [servicesRes, techRes] = await Promise.all([
          api.get('/services'),
          api.get('/technicians')
        ]);
        setServices(servicesRes.data || []);
        setTechnicians(techRes.data || []);
      } catch (error) {
        // non-blocking
        console.error('Error fetching lookups:', error);
      }
    };
    fetchLookups();
  }, []);

  useEffect(() => {
    if (!expandedPhoto) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setExpandedPhoto(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandedPhoto]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/work-orders/${id}`);
      const data = response.data || {};
      const measurements = Array.isArray(data.measurements) ? data.measurements : [];
      setOrder({
        ...data,
        measurements: measurements.map((m) => ({
          ...m,
          housing_measurements: Array.isArray(m.housing_measurements) ? m.housing_measurements : (Array.isArray(m.housingMeasurements) ? m.housingMeasurements : [])
        }))
      });
    } catch (error) {
      console.error('Error fetching work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    setLoadingActivity(true);
    try {
      const res = await api.get(`/work-orders/${id}/activity`);
      setActivityLog(res.data || []);
    } catch (e) {
      setActivityLog([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bitacora') fetchActivity();
  }, [activeTab, id]);

  const toDateInputValue = (value) => {
    if (!value) return '';
    try {
      if (typeof value === 'string') return value.split('T')[0];
      // fallback
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    } catch (_) {
      return '';
    }
  };

  const startEdit = () => {
    if (!order) return;
    const orderServicesList = order.services || [];
    setEditData({
      title: order.title || '',
      equipmentId: order.equipment_id ? String(order.equipment_id) : '',
      serviceLocation: order.service_location || '',
      clientServiceOrderNumber: order.client_service_order_number || '',
      priority: order.priority || 'medium',
      scheduledDate: toDateInputValue(order.scheduled_date),
      assignedTechnicianId: order.assigned_technician_id ? String(order.assigned_technician_id) : '',
      services: orderServicesList.length > 0
        ? orderServicesList.map(s => ({
            serviceId: String(s.service_id),
            housingCount: (s.housings || []).length || s.housing_count || 0,
            housings: (s.housings || []).map(h => ({
              measureCode: h.measure_code,
              description: h.description,
              nominalValue: h.nominal_value,
              nominalUnit: h.nominal_unit,
              tolerance: h.tolerance
            }))
          }))
        : [{ serviceId: '', housingCount: 0, housings: [] }],
      description: order.description || ''
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setSaving(false);
    setShowHousingsModal(false);
    setEditingServiceIdx(null);
  };

  const openEditMeasurementModal = (measurement) => {
    const housings = measurement.housing_measurements ?? measurement.housingMeasurements ?? [];
    setEditingMeasurement(measurement);
    setEditMeasurementForm({
      notes: measurement.notes ?? '',
      housingMeasurements: housings.map(hm => ({
        housingId: hm.housing_id,
        measure_code: hm.measure_code,
        housing_description: hm.housing_description,
        x1: hm.x1 != null && hm.x1 !== '' ? String(hm.x1) : '',
        y1: hm.y1 != null && hm.y1 !== '' ? String(hm.y1) : '',
        unit: hm.unit ?? ''
      }))
    });
    setShowEditMeasurementModal(true);
  };

  const saveEditMeasurement = async () => {
    if (!editingMeasurement || !id) return;
    setSavingMeasurement(true);
    try {
      await api.put(`/work-orders/${id}/measurements/${editingMeasurement.id}`, editMeasurementForm);
      showSuccess('Medición actualizada');
      setShowEditMeasurementModal(false);
      setEditingMeasurement(null);
      fetchOrder();
    } catch (err) {
      showError(err.response?.data?.error || 'Error al actualizar la medición');
    } finally {
      setSavingMeasurement(false);
    }
  };

  const numberToLetters = (n) => {
    let num = n;
    let s = '';
    while (num > 0) {
      const mod = (num - 1) % 26;
      s = String.fromCharCode(65 + mod) + s;
      num = Math.floor((num - 1) / 26);
    }
    return s;
  };

  const openHousingsModalForService = (idx) => {
    const os = (editData.services || [])[idx];
    const count = Number(os?.housingCount) || 0;
    if (count <= 0) {
      showError('Indique la cantidad de alojamientos antes de configurarlos.');
      return;
    }
    const existing = os?.housings || [];
    const next = Array.from({ length: count }).map((_, i) => {
      if (existing[i]) return { ...existing[i], measureCode: existing[i].measureCode || numberToLetters(i + 1) };
      return {
        measureCode: numberToLetters(i + 1),
        description: '',
        nominalValue: '',
        nominalUnit: '',
        tolerance: ''
      };
    });
    const nextServices = [...(editData.services || [])];
    nextServices[idx] = { ...nextServices[idx], housings: next };
    setEditData({ ...editData, services: nextServices });
    setEditingServiceIdx(idx);
    setShowHousingsModal(true);
  };

  const closeHousingsModal = (save = false) => {
    if (save && editingServiceIdx !== null) {
      const os = (editData.services || [])[editingServiceIdx];
      const housings = os?.housings || [];
      const hasMissing = housings.some(
        (h) => !h.measureCode || !h.description || (h.nominalValue !== '' && h.nominalValue !== undefined && !h.nominalUnit)
      );
      if (hasMissing) {
        showError('Complete Medida y Descripción. Si ingresa Medida Nominal, también indique la Unidad.');
        return;
      }
    }
    setShowHousingsModal(false);
    setEditingServiceIdx(null);
  };

  const updateEditHousing = (idx, field, value) => {
    const next = [...(editData.services || [])];
    const h = next[editingServiceIdx]?.housings || [];
    const hi = h[idx];
    if (hi) {
      h[idx] = { ...hi, [field]: value };
      next[editingServiceIdx] = { ...next[editingServiceIdx], housings: h };
      setEditData({ ...editData, services: next });
    }
  };

  const saveEdit = async () => {
    if (!order) return;
    const payload = {};

    if (editData.title !== (order.title || '')) payload.title = editData.title;
    const currentEquipmentId = order.equipment_id ? String(order.equipment_id) : '';
    if (editData.equipmentId !== currentEquipmentId) {
      payload.equipmentId = editData.equipmentId ? parseInt(editData.equipmentId) : null;
    }
    if (editData.serviceLocation !== (order.service_location || '')) payload.serviceLocation = editData.serviceLocation;
    if (editData.clientServiceOrderNumber !== (order.client_service_order_number || '')) {
      payload.clientServiceOrderNumber = editData.clientServiceOrderNumber;
    }
    if (editData.priority !== (order.priority || 'medium')) payload.priority = editData.priority;

    const currentScheduled = toDateInputValue(order.scheduled_date);
    if (editData.scheduledDate !== currentScheduled) {
      payload.scheduledDate = editData.scheduledDate || null;
    }

    const currentAssigned = order.assigned_technician_id ? String(order.assigned_technician_id) : '';
    if (editData.assignedTechnicianId !== currentAssigned) {
      payload.assignedTechnicianId = editData.assignedTechnicianId ? parseInt(editData.assignedTechnicianId) : null;
    }

    const currentServices = (order.services || []).map(s => ({
      serviceId: String(s.service_id),
      housingCount: (s.housings || []).length || s.housing_count || 0,
      housings: (s.housings || []).map(h => ({ measureCode: h.measure_code, description: h.description, nominalValue: h.nominal_value, nominalUnit: h.nominal_unit, tolerance: h.tolerance }))
    }));
    const newServices = (editData.services || []).filter(s => s.serviceId).map(s => ({
      serviceId: parseInt(s.serviceId),
      housingCount: parseInt(s.housingCount) || 0,
      housings: (s.housings || []).map(h => ({
        measureCode: h.measureCode || h.measure_code,
        description: h.description,
        nominalValue: h.nominalValue !== undefined && h.nominalValue !== null && h.nominalValue !== '' ? parseFloat(h.nominalValue) : null,
        nominalUnit: h.nominalValue !== undefined && h.nominalValue !== null && h.nominalValue !== '' ? (h.nominalUnit || h.nominal_unit) : null,
        tolerance: h.tolerance || null
      }))
    }));
    const servicesChanged = JSON.stringify(currentServices) !== JSON.stringify(newServices);
    if (servicesChanged) {
      payload.services = newServices;
    }

    if (editData.description !== (order.description || '')) payload.description = editData.description;

    if (Object.keys(payload).length === 0) {
      showSuccess('No hay cambios para guardar');
      setEditMode(false);
      return;
    }

    setSaving(true);
    try {
      await api.put(`/work-orders/${id}`, payload);
      showSuccess('Orden actualizada');
      setEditMode(false);
      fetchOrder();
    } catch (error) {
      console.error('Error saving work order:', error);
      showError(error.response?.data?.error || 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.put(`/work-orders/${id}`, { status: newStatus });
      fetchOrder();
      if (activeTab === 'bitacora') fetchActivity();
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

  const handleDeletePhoto = (photoId) => {
    showConfirm(
      '¿Eliminar esta foto? Esta acción no se puede deshacer.',
      async () => {
        try {
          await api.delete(`/work-orders/${id}/photos/${photoId}`);
          showSuccess('Foto eliminada');
          fetchOrder();
        } catch (error) {
          showError('Error al eliminar la foto');
        }
      },
      'Eliminar foto',
      { confirmText: 'Eliminar', cancelText: 'Cancelar', confirmDanger: true }
    );
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!order) {
    return <div className="error">Orden no encontrada</div>;
  }

  const measurementsList = Array.isArray(order.measurements) ? order.measurements : [];
  const measurementHasData = (m) => {
    const housings = m.housing_measurements ?? m.housingMeasurements ?? [];
    if (!Array.isArray(housings) || housings.length === 0) return false;
    return housings.some(hm => (hm.x1 != null && hm.x1 !== '') || (hm.y1 != null && hm.y1 !== '') || (hm.unit != null && hm.unit !== ''));
  };
  const getMeasurementDate = (m) => new Date(m?.measurement_date ?? m?.measurementDate ?? 0).getTime();
  const initialMeasurements = measurementsList
    .filter(m => {
      const t = String(m?.measurement_type ?? m?.measurementType ?? '').toLowerCase();
      return t === 'initial';
    })
    .filter(measurementHasData)
    .sort((a, b) => getMeasurementDate(b) - getMeasurementDate(a))
    .slice(0, 1);
  const finalMeasurements = measurementsList
    .filter(m => {
      const t = String(m?.measurement_type ?? m?.measurementType ?? '').toLowerCase();
      return t === 'final';
    })
    .filter(measurementHasData)
    .sort((a, b) => getMeasurementDate(b) - getMeasurementDate(a))
    .slice(0, 1);

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

  const handleDownloadReport = async () => {
    try {
      const response = await api.get(`/work-orders/${id}/report`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `OT-${order.order_number || id}-reporte.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showError(e.response?.data?.error || 'Error al descargar el reporte PDF');
    }
  };

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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={handleDownloadReport} title="Descargar reporte en PDF">
            📄 Reporte PDF
          </button>
          {!editMode ? (
            <button type="button" className="btn-primary" onClick={startEdit}>
              Editar
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
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
        <button
          className={activeTab === 'bitacora' ? 'active' : ''}
          onClick={() => setActiveTab('bitacora')}
        >
          Bitácora
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
                  <option value="on_hold">En Espera</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>

              <div className="info-item">
                <label>Cliente</label>
                <p>{order.client_name}</p>
              </div>

              <div className="info-item">
                <label>Equipo</label>
                {editMode ? (
                  <SearchableSelect
                    value={editData.equipmentId}
                    onChange={(val) => setEditData({ ...editData, equipmentId: val })}
                    options={equipmentOptions.map((eq) => ({
                      value: String(eq.id),
                      label: `${eq.brand_name} ${eq.model_name} - ${eq.serial_number}${eq.client_name ? ` (${eq.client_name})` : ''}`
                    }))}
                    placeholder="Escriba para buscar equipo..."
                    disabled={!order?.client_id}
                  />
                ) : (
                  <p>{order.equipment_name}</p>
                )}
              </div>

              <div className="info-item">
                <label>Ubicación del Servicio</label>
                {editMode ? (
                  <input
                    value={editData.serviceLocation}
                    onChange={(e) => setEditData({ ...editData, serviceLocation: e.target.value })}
                    placeholder="Ubicación del servicio"
                  />
                ) : (
                  <p>{order.service_location || 'No especificada'}</p>
                )}
              </div>

              <div className="info-item">
                <label>N° Orden de Servicio del Cliente</label>
                {editMode ? (
                  <input
                    value={editData.clientServiceOrderNumber}
                    onChange={(e) => setEditData({ ...editData, clientServiceOrderNumber: e.target.value })}
                    placeholder="Ej: OS-12345"
                  />
                ) : (
                  <p>{order.client_service_order_number || '-'}</p>
                )}
              </div>

              <div className="info-item">
                <label>Técnico Asignado</label>
                {editMode ? (
                  <select
                    value={editData.assignedTechnicianId}
                    onChange={(e) => setEditData({ ...editData, assignedTechnicianId: e.target.value })}
                  >
                    <option value="">Sin asignar</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p>{order.technician_name || 'Sin asignar'}</p>
                )}
              </div>

              <div className="info-item">
                <label>Prioridad</label>
                {editMode ? (
                  <select
                    value={editData.priority}
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                ) : (
                  <p>{order.priority === 'low' ? 'Baja' :
                      order.priority === 'medium' ? 'Media' :
                      order.priority === 'high' ? 'Alta' : 'Urgente'}</p>
                )}
              </div>

              <div className="info-item">
                <label>Fecha Programada</label>
                {editMode ? (
                  <input
                    type="date"
                    value={editData.scheduledDate}
                    onChange={(e) => setEditData({ ...editData, scheduledDate: e.target.value })}
                  />
                ) : (
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
                )}
              </div>

              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <label>Servicios</label>
                {editMode ? (
                  <div>
                    {(editData.services || []).map((os, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
                          <SearchableSelect
                            value={os.serviceId}
                            onChange={(val) => {
                              const next = [...(editData.services || [])];
                              next[idx] = { ...next[idx], serviceId: val };
                              setEditData({ ...editData, services: next });
                            }}
                            options={services
                              .filter(s => !(editData.services || []).some((o, i) => i !== idx && o.serviceId === String(s.id)))
                              .map((s) => ({ value: String(s.id), label: `${s.code} - ${s.name}` }))}
                            placeholder="Seleccionar servicio..."
                          />
                        </div>
                        <div style={{ flex: '1 1 100px', minWidth: 100 }}>
                          <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Alojamientos</label>
                          <input
                            type="number"
                            min="0"
                            value={os.housingCount || ''}
                            onChange={(e) => {
                              const count = Number(e.target.value) || 0;
                              const next = [...(editData.services || [])];
                              const existing = next[idx].housings || [];
                              const newHousings = Array.from({ length: count }).map((_, i) => {
                                if (existing[i]) return existing[i];
                                return {
                                  measureCode: numberToLetters(i + 1),
                                  description: '',
                                  nominalValue: '',
                                  nominalUnit: '',
                                  tolerance: ''
                                };
                              });
                              next[idx] = { ...next[idx], housingCount: e.target.value, housings: newHousings };
                              setEditData({ ...editData, services: next });
                              if (count > 0) {
                                setEditingServiceIdx(idx);
                                setShowHousingsModal(true);
                              }
                            }}
                            placeholder="0"
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openHousingsModalForService(idx)}
                            title="Ver / Editar alojamientos"
                            style={{ padding: '8px 12px' }}
                          >
                            📋
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEditData({ ...editData, services: (editData.services || []).filter((_, i) => i !== idx) })}
                            title="Quitar servicio"
                            style={{ padding: '8px 12px' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setEditData({ ...editData, services: [...(editData.services || []), { serviceId: '', housingCount: 0, housings: [] }] })}
                      style={{ marginTop: 4 }}
                    >
                      + Agregar Servicio
                    </button>
                  </div>
                ) : (
                  <div>
                    {(order.services || []).length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {(order.services || []).map((s, i) => (
                          <li key={i}>
                            {s.service_code} {s.service_name} — {((s.housings || []).length || s.housing_count || 0)} alojamiento(s)
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                )}
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
                <label>Fecha de Creación</label>
                <p>{new Date(order.created_at).toLocaleString('es-PA')}</p>
              </div>
            </div>

            <div className="description-section">
              <label>Descripción</label>
              {editMode ? (
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={4}
                  placeholder="Descripción"
                />
              ) : (
                <p>{order.description || 'Sin descripción'}</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'measurements' && (
          <div className="measurements-section">
            <h2>Mediciones Iniciales</h2>
            {initialMeasurements.length > 0 ? (
              <div className="measurements-list">
                {initialMeasurements.map(measurement => {
                  const housings = measurement.housing_measurements ?? measurement.housingMeasurements ?? [];
                  const hasHousings = Array.isArray(housings) && housings.length > 0;
                  return (
                  <div key={measurement.id} className="measurement-card">
                    <div className="measurement-header">
                      <span>{new Date(measurement.measurement_date).toLocaleString('es-PA')}</span>
                      <button type="button" className="btn-secondary" style={{ marginLeft: 'auto', fontSize: '0.9rem' }} onClick={() => openEditMeasurementModal(measurement)}>Editar</button>
                    </div>

                    {hasHousings ? (
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
                            {housings.map((hm) => (
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
                        <div style={{ marginTop: 8 }}>
                          <strong>Observaciones:</strong> {measurement.notes || '-'}
                        </div>
                      </div>
                    ) : (
                      <div className="measurement-values">
                        {measurement.temperature != null && measurement.temperature !== '' && <div>Temperatura: {measurement.temperature}°C</div>}
                        {measurement.pressure != null && measurement.pressure !== '' && <div>Presión: {measurement.pressure}</div>}
                        {measurement.voltage != null && measurement.voltage !== '' && <div>Voltaje: {measurement.voltage}V</div>}
                        {measurement.current != null && measurement.current !== '' && <div>Corriente: {measurement.current}A</div>}
                        {measurement.resistance != null && measurement.resistance !== '' && <div>Resistencia: {measurement.resistance}Ω</div>}
                        {(measurement.notes != null && measurement.notes !== '') && (
                          <div style={{ marginTop: 8 }}><strong>Observaciones:</strong> {measurement.notes}</div>
                        )}
                        {!hasHousings && (
                          <p style={{ color: 'var(--text-light)', marginTop: 8, marginBottom: 0 }}>
                            No se cargaron valores por alojamiento (X1, Y1, unidad) en esta medición.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="empty-message">No hay mediciones iniciales</p>
            )}

            <h2>Mediciones Finales</h2>
            {finalMeasurements.length > 0 ? (
              <div className="measurements-list">
                {finalMeasurements.map(measurement => {
                  const housings = measurement.housing_measurements ?? measurement.housingMeasurements ?? [];
                  const hasHousings = Array.isArray(housings) && housings.length > 0;
                  return (
                  <div key={measurement.id} className="measurement-card">
                    <div className="measurement-header">
                      <span>{new Date(measurement.measurement_date).toLocaleString('es-PA')}</span>
                      <button type="button" className="btn-secondary" style={{ marginLeft: 'auto', fontSize: '0.9rem' }} onClick={() => openEditMeasurementModal(measurement)}>Editar</button>
                    </div>

                    {hasHousings ? (
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
                            {housings.map((hm) => (
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
                        <div style={{ marginTop: 8 }}>
                          <strong>Observaciones:</strong> {measurement.notes || '-'}
                        </div>
                      </div>
                    ) : (
                      <div className="measurement-values">
                        {measurement.temperature != null && measurement.temperature !== '' && <div>Temperatura: {measurement.temperature}°C</div>}
                        {measurement.pressure != null && measurement.pressure !== '' && <div>Presión: {measurement.pressure}</div>}
                        {measurement.voltage != null && measurement.voltage !== '' && <div>Voltaje: {measurement.voltage}V</div>}
                        {measurement.current != null && measurement.current !== '' && <div>Corriente: {measurement.current}A</div>}
                        {measurement.resistance != null && measurement.resistance !== '' && <div>Resistencia: {measurement.resistance}Ω</div>}
                        {(measurement.notes != null && measurement.notes !== '') && (
                          <div style={{ marginTop: 8 }}><strong>Observaciones:</strong> {measurement.notes}</div>
                        )}
                        {!hasHousings && (
                          <p style={{ color: 'var(--text-light)', marginTop: 8, marginBottom: 0 }}>
                            No se cargaron valores por alojamiento (X1, Y1, unidad) en esta medición.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
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
                    <img
                      src={getStaticUrl(photo.photo_path)}
                      alt={photo.description || 'Foto'}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedPhoto(photo)}
                      onKeyDown={(e) => e.key === 'Enter' && setExpandedPhoto(photo)}
                      title="Ampliar"
                    />
                    <p>{photo.description || 'Sin descripción'}</p>
                    <button
                      type="button"
                      className="photo-delete-btn"
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                      title="Eliminar foto"
                      aria-label="Eliminar foto"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No hay fotos</p>
            )}

            {expandedPhoto && (
              <div
                className="photo-lightbox-overlay"
                onClick={() => setExpandedPhoto(null)}
                role="dialog"
                aria-modal="true"
                aria-label="Foto ampliada"
              >
                <button
                  type="button"
                  className="photo-lightbox-close"
                  onClick={() => setExpandedPhoto(null)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
                <img
                  src={getStaticUrl(expandedPhoto.photo_path)}
                  alt={expandedPhoto.description || 'Foto ampliada'}
                  onClick={(e) => e.stopPropagation()}
                  className="photo-lightbox-img"
                />
              </div>
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
                    const isVisible = isDocVisibleToTechnician(doc);
                    
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
                                  isVisibleToTechnician: d.id === doc.id ? e.target.checked : isDocVisibleToTechnician(d)
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

        {activeTab === 'bitacora' && (
          <div className="bitacora-section">
            <h3>Bitácora de la OT</h3>
            {loadingActivity ? (
              <p className="empty-message">Cargando...</p>
            ) : activityLog.length === 0 ? (
              <p className="empty-message">No hay registros en la bitácora</p>
            ) : (
              <ul className="bitacora-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {activityLog.map((entry) => (
                  <li key={entry.id} style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, minWidth: 140 }}>
                      {new Date(entry.created_at).toLocaleString('es-PA')}
                    </span>
                    <span>{entry.description || entry.action}</span>
                    {entry.user_name && (
                      <span style={{ color: 'var(--text-light)', fontSize: '0.9em' }}>— {entry.user_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {showHousingsModal && editingServiceIdx !== null && editMode && (
        <div className="modal-overlay" onClick={() => closeHousingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 750 }}>
            <h2>Alojamientos — {(services.find(s => s.id === parseInt((editData.services || [])[editingServiceIdx]?.serviceId))?.name || 'Servicio')}</h2>
            <p style={{ marginTop: -8, color: '#6e6b7b' }}>
              Complete la información de cada alojamiento. Cada servicio comienza con A, B, C...
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medida</th>
                    <th>Descripción</th>
                    <th>Medida Nominal</th>
                    <th>Tolerancia</th>
                    <th>Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {((editData.services || [])[editingServiceIdx]?.housings || []).map((h, idx) => (
                    <tr key={h.measureCode + idx}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{h.measureCode}</td>
                      <td>
                        <input
                          value={h.description || ''}
                          onChange={(e) => updateEditHousing(idx, 'description', e.target.value)}
                          placeholder="Descripción del alojamiento"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.001"
                          value={h.nominalValue ?? ''}
                          onChange={(e) => updateEditHousing(idx, 'nominalValue', e.target.value)}
                          placeholder="0.000"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={h.tolerance || ''}
                          onChange={(e) => updateEditHousing(idx, 'tolerance', e.target.value)}
                          placeholder="+0.5, -0.3, ±0.2"
                        />
                      </td>
                      <td>
                        <input
                          value={h.nominalUnit || ''}
                          onChange={(e) => updateEditHousing(idx, 'nominalUnit', e.target.value)}
                          placeholder="mm, in, etc."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => closeHousingsModal(false)}>Cerrar</button>
              <button type="button" className="btn-primary" onClick={() => closeHousingsModal(true)}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditMeasurementModal && editingMeasurement && (
        <div className="modal-overlay" onClick={() => !savingMeasurement && (setShowEditMeasurementModal(false), setEditingMeasurement(null))}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <h2>Editar medición — {new Date(editingMeasurement.measurement_date).toLocaleString('es-PA')}</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Observaciones</label>
              <textarea
                value={editMeasurementForm.notes}
                onChange={(e) => setEditMeasurementForm({ ...editMeasurementForm, notes: e.target.value })}
                rows={2}
                style={{ width: '100%', padding: 8 }}
                placeholder="Observaciones de la medición"
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medida</th>
                    <th>Descripción</th>
                    <th>X1</th>
                    <th>Y1</th>
                    <th>Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {editMeasurementForm.housingMeasurements.map((hm, idx) => (
                    <tr key={hm.housingId}>
                      <td style={{ fontWeight: 700 }}>{hm.measure_code ?? '-'}</td>
                      <td>{hm.housing_description ?? '-'}</td>
                      <td>
                        <input
                          type="number"
                          step="0.001"
                          value={hm.x1}
                          onChange={(e) => {
                            const next = editMeasurementForm.housingMeasurements.map((r, i) => i === idx ? { ...r, x1: e.target.value } : r);
                            setEditMeasurementForm({ ...editMeasurementForm, housingMeasurements: next });
                          }}
                          placeholder="0.000"
                          style={{ width: 90 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.001"
                          value={hm.y1}
                          onChange={(e) => {
                            const next = editMeasurementForm.housingMeasurements.map((r, i) => i === idx ? { ...r, y1: e.target.value } : r);
                            setEditMeasurementForm({ ...editMeasurementForm, housingMeasurements: next });
                          }}
                          placeholder="0.000"
                          style={{ width: 90 }}
                        />
                      </td>
                      <td>
                        <input
                          value={hm.unit}
                          onChange={(e) => {
                            const next = editMeasurementForm.housingMeasurements.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r);
                            setEditMeasurementForm({ ...editMeasurementForm, housingMeasurements: next });
                          }}
                          placeholder="In, mm..."
                          style={{ width: 70 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => { setShowEditMeasurementModal(false); setEditingMeasurement(null); }} disabled={savingMeasurement}>Cerrar</button>
              <button type="button" className="btn-primary" onClick={saveEditMeasurement} disabled={savingMeasurement}>
                {savingMeasurement ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={closeAlert}
        type={alertDialog.type}
        title={alertDialog.title}
        message={alertDialog.message}
        onConfirm={alertDialog.onConfirm}
        showCancel={alertDialog.showCancel}
        confirmText={alertDialog.confirmText}
        cancelText={alertDialog.cancelText}
        confirmDanger={alertDialog.confirmDanger}
      />
    </div>
  );
}

