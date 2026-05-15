import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getStaticUrl } from '../../config.js';
import { getWorkingDaysCount } from '../../utils/workOrderWorkingDays.js';
import { openWorkOrderDocumentInNewTab } from '../../utils/openWorkOrderDocument.js';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import SearchableSelect from '../../components/SearchableSelect';
import { isMachiningRepairByTypeName, isMachiningRepairServiceType } from '../../utils/serviceTypeHousings';
import { SHIFT_DAY, SHIFT_NIGHT, shiftLabel } from '../../utils/serviceTechnicianShift';
import {
  createDefaultComponent,
  findGeneralComponentId,
  mapComponentsFromApi,
  mapComponentsToPayload,
  mapHousingFromApi,
  totalHousingCount
} from '../../utils/workOrderComponents';
import WorkOrderServiceComponentsEditor from '../../components/WorkOrderComponentsEditor';
import '../../components/WorkOrderComponentsEditor.css';
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
    locationId: '',
    serviceTypeId: '',
    clientServiceOrderNumber: '',
    priority: 'medium',
    scheduledDate: '',
    startDate: '',
    completionDate: '',
    services: [],
    description: ''
  });
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [componentsCatalog, setComponentsCatalog] = useState([]);
  const [generalComponentId, setGeneralComponentId] = useState(null);
  const [showHousingsModal, setShowHousingsModal] = useState(false);
  const [editingServiceIdx, setEditingServiceIdx] = useState(null);
  const [editingComponentIdx, setEditingComponentIdx] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showEditMeasurementModal, setShowEditMeasurementModal] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState(null);
  const [editMeasurementForm, setEditMeasurementForm] = useState({ notes: '', housingMeasurements: [] });
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [superintendentSigSignedBy, setSuperintendentSigSignedBy] = useState('');
  const [superintendentSigUploading, setSuperintendentSigUploading] = useState(false);
  const [adminPhotoUploading, setAdminPhotoUploading] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [photoEditData, setPhotoEditData] = useState({ workOrderServiceId: '', photoType: 'during_service', description: '' });
  const [photoEditSaving, setPhotoEditSaving] = useState(false);

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
        const [servicesRes, techRes, locationsRes, typesRes, componentsRes] = await Promise.all([
          api.get('/services'),
          api.get('/technicians'),
          api.get('/locations'),
          api.get('/service-types'),
          api.get('/components')
        ]);
        setServices(servicesRes.data || []);
        setTechnicians(techRes.data || []);
        setLocations(locationsRes.data || []);
        setServiceTypes(typesRes.data || []);
        const compList = componentsRes.data || [];
        setComponentsCatalog(compList);
        setGeneralComponentId(findGeneralComponentId(compList));
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
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    } catch (_) {
      return '';
    }
  };

  const toDateTimeLocalValue = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      locationId: order.location_id ? String(order.location_id) : '',
      serviceTypeId: order.service_type_id ? String(order.service_type_id) : '',
      clientServiceOrderNumber: order.client_service_order_number || '',
      priority: order.priority || 'medium',
      scheduledDate: toDateInputValue(order.scheduled_date),
      startDate: toDateTimeLocalValue(order.start_date),
      completionDate: toDateTimeLocalValue(order.completion_date),
      services: orderServicesList.length > 0
        ? orderServicesList.map((s) => {
            const gid = generalComponentId || findGeneralComponentId(componentsCatalog);
            const components =
              Array.isArray(s.components) && s.components.length > 0
                ? mapComponentsFromApi(s.components, gid)
                : [
                    {
                      ...createDefaultComponent(gid),
                      housingCount: (s.housings || []).length || s.housing_count || 0,
                      housings: (s.housings || []).map(mapHousingFromApi)
                    }
                  ];
            return {
              serviceId: String(s.service_id),
              housingCount: totalHousingCount(components),
              components,
              technicians: (s.technicians || []).length > 0
                ? s.technicians.map((t) => ({
                    technicianId: String(t.technician_id),
                    shift: t.shift === SHIFT_NIGHT || t.shift === 'night' ? SHIFT_NIGHT : SHIFT_DAY
                  }))
                : [{ technicianId: '', shift: SHIFT_DAY }]
            };
          })
        : [
            {
              serviceId: '',
              housingCount: 0,
              components: [createDefaultComponent(generalComponentId)],
              technicians: [{ technicianId: '', shift: SHIFT_DAY }]
            }
          ],
      description: order.description || ''
    });
    setEditMode(true);
  };

  const selectedServiceIds = new Set(
    (editData.services || []).filter((os) => os.serviceId).map((os) => String(os.serviceId))
  );
  const servicesForOrder = services.filter(
    (s) =>
      !editData.serviceTypeId ||
      String(s.service_type_id) === String(editData.serviceTypeId) ||
      selectedServiceIds.has(String(s.id))
  );

  const needsOrderHousings = isMachiningRepairServiceType(serviceTypes, editData.serviceTypeId);

  const cancelEdit = () => {
    setEditMode(false);
    setSaving(false);
    setShowHousingsModal(false);
    setEditingServiceIdx(null);
  };

  const addEditTechnicianRow = (serviceIdx) => {
    const next = [...(editData.services || [])];
    const techs = [...(next[serviceIdx].technicians || []), { technicianId: '', shift: SHIFT_DAY }];
    next[serviceIdx] = { ...next[serviceIdx], technicians: techs };
    setEditData({ ...editData, services: next });
  };

  const removeEditTechnicianRow = (serviceIdx, techIdx) => {
    const next = [...(editData.services || [])];
    const techs = (next[serviceIdx].technicians || []).filter((_, i) => i !== techIdx);
    next[serviceIdx] = {
      ...next[serviceIdx],
      technicians: techs.length ? techs : [{ technicianId: '', shift: SHIFT_DAY }]
    };
    setEditData({ ...editData, services: next });
  };

  const updateEditTechnician = (serviceIdx, techIdx, field, value) => {
    const next = [...(editData.services || [])];
    const techs = [...(next[serviceIdx].technicians || [])];
    if (techs[techIdx]) {
      techs[techIdx] = { ...techs[techIdx], [field]: value };
      next[serviceIdx] = { ...next[serviceIdx], technicians: techs };
      setEditData({ ...editData, services: next });
    }
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
        service_code: hm.service_code,
        service_name: hm.service_name,
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

  const removeEditMeasurementRow = (idx) => {
    showConfirm(
      '¿Quitar esta fila de la medición? Pulse Guardar para guardar los cambios en el servidor.',
      () => {
        setEditMeasurementForm((prev) => ({
          ...prev,
          housingMeasurements: prev.housingMeasurements.filter((_, i) => i !== idx),
        }));
      },
      'Quitar fila',
      { confirmText: 'Quitar', cancelText: 'Cancelar', confirmDanger: true }
    );
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

  const addComponentToService = (serviceIdx) => {
    const next = [...(editData.services || [])];
    const comps = [...(next[serviceIdx].components || []), createDefaultComponent(generalComponentId)];
    next[serviceIdx] = { ...next[serviceIdx], components: comps };
    setEditData({ ...editData, services: next });
  };

  const removeComponentFromService = (serviceIdx, componentIdx) => {
    const next = [...(editData.services || [])];
    const comps = (next[serviceIdx].components || []).filter((_, i) => i !== componentIdx);
    next[serviceIdx] = {
      ...next[serviceIdx],
      components: comps.length ? comps : [createDefaultComponent(generalComponentId)]
    };
    setEditData({ ...editData, services: next });
  };

  const updateServiceComponent = (serviceIdx, componentIdx, field, value) => {
    const next = [...(editData.services || [])];
    const comps = [...(next[serviceIdx].components || [])];
    if (!comps[componentIdx]) return;
    comps[componentIdx] = { ...comps[componentIdx], [field]: value };
    if (field === 'housingCount' && needsOrderHousings) {
      const count = Number(value) || 0;
      const existing = comps[componentIdx].housings || [];
      if (count > 0) {
        comps[componentIdx].housings = Array.from({ length: count }).map((_, i) => {
          if (existing[i]) return { ...existing[i], measureCode: existing[i].measureCode || numberToLetters(i + 1) };
          return {
            measureCode: numberToLetters(i + 1),
            description: '',
            nominalValue: '',
            nominalUnit: '',
            tolerance: ''
          };
        });
        next[serviceIdx] = { ...next[serviceIdx], components: comps };
        setEditData({ ...editData, services: next });
        setEditingServiceIdx(serviceIdx);
        setEditingComponentIdx(componentIdx);
        setShowHousingsModal(true);
        return;
      }
      comps[componentIdx].housings = [];
    }
    next[serviceIdx] = { ...next[serviceIdx], components: comps };
    setEditData({ ...editData, services: next });
  };

  const openHousingsModalForComponent = (serviceIdx, componentIdx) => {
    if (!needsOrderHousings) return;
    const comp = (editData.services || [])[serviceIdx]?.components?.[componentIdx];
    const count = Number(comp?.housingCount) || 0;
    if (count <= 0) {
      showError('Indique la cantidad de alojamientos del componente antes de configurarlos.');
      return;
    }
    const existing = comp?.housings || [];
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
    const comps = [...(nextServices[serviceIdx].components || [])];
    comps[componentIdx] = { ...comps[componentIdx], housings: next };
    nextServices[serviceIdx] = { ...nextServices[serviceIdx], components: comps };
    setEditData({ ...editData, services: nextServices });
    setEditingServiceIdx(serviceIdx);
    setEditingComponentIdx(componentIdx);
    setShowHousingsModal(true);
  };

  const closeHousingsModal = (save = false) => {
    if (save && editingServiceIdx !== null && editingComponentIdx !== null) {
      const housings =
        (editData.services || [])[editingServiceIdx]?.components?.[editingComponentIdx]?.housings || [];
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
    setEditingComponentIdx(null);
  };

  const updateEditHousing = (idx, field, value) => {
    if (editingServiceIdx === null || editingComponentIdx === null) return;
    const next = [...(editData.services || [])];
    const comps = [...(next[editingServiceIdx].components || [])];
    const h = [...(comps[editingComponentIdx].housings || [])];
    if (h[idx]) {
      h[idx] = { ...h[idx], [field]: value };
      comps[editingComponentIdx] = { ...comps[editingComponentIdx], housings: h };
      next[editingServiceIdx] = { ...next[editingServiceIdx], components: comps };
      setEditData({ ...editData, services: next });
    }
  };

  const removeEditHousingRow = (housingIdx) => {
    if (editingServiceIdx === null || editingComponentIdx === null) return;
    showConfirm(
      '¿Eliminar este alojamiento? Debe guardar la OT para aplicar el cambio. Si ya hay mediciones en ese alojamiento, el servidor no lo permitirá hasta quitarlas.',
      () => {
        const next = [...(editData.services || [])];
        const comps = [...(next[editingServiceIdx].components || [])];
        const hList = [...(comps[editingComponentIdx].housings || [])];
        hList.splice(housingIdx, 1);
        comps[editingComponentIdx] = {
          ...comps[editingComponentIdx],
          housings: hList,
          housingCount: hList.length
        };
        next[editingServiceIdx] = { ...next[editingServiceIdx], components: comps };
        setEditData({ ...editData, services: next });
        if (hList.length === 0) {
          setShowHousingsModal(false);
          setEditingServiceIdx(null);
          setEditingComponentIdx(null);
        }
      },
      'Eliminar alojamiento',
      { confirmText: 'Eliminar', cancelText: 'Cancelar', confirmDanger: true }
    );
  };

  const saveEdit = async () => {
    if (!order) return;
    const payload = {};

    if (editData.title !== (order.title || '')) payload.title = editData.title;
    const currentEquipmentId = order.equipment_id ? String(order.equipment_id) : '';
    if (editData.equipmentId !== currentEquipmentId) {
      payload.equipmentId = editData.equipmentId ? parseInt(editData.equipmentId) : null;
    }
    const currentLocationId = order.location_id ? String(order.location_id) : '';
    if (editData.locationId !== currentLocationId) payload.locationId = editData.locationId || null;
    const currentServiceTypeId = order.service_type_id ? String(order.service_type_id) : '';
    if (editData.serviceTypeId !== currentServiceTypeId) payload.serviceTypeId = editData.serviceTypeId || null;
    if (editData.clientServiceOrderNumber !== (order.client_service_order_number || '')) {
      payload.clientServiceOrderNumber = editData.clientServiceOrderNumber;
    }
    if (editData.priority !== (order.priority || 'medium')) payload.priority = editData.priority;

    const currentScheduled = toDateInputValue(order.scheduled_date);
    if (editData.scheduledDate !== currentScheduled) {
      payload.scheduledDate = editData.scheduledDate || null;
    }

    const currentStartDate = toDateTimeLocalValue(order.start_date);
    if (editData.startDate !== currentStartDate) payload.startDate = editData.startDate || null;
    const currentCompletionDate = toDateTimeLocalValue(order.completion_date);
    if (editData.completionDate !== currentCompletionDate) payload.completionDate = editData.completionDate || null;

    const mapHousingRow = (h) => {
      const nv = h.nominalValue ?? h.nominal_value;
      const hasNom = nv !== undefined && nv !== null && nv !== '';
      return {
        measureCode: h.measureCode || h.measure_code,
        description: h.description,
        nominalValue: hasNom ? parseFloat(nv) : null,
        nominalUnit: hasNom ? (h.nominalUnit || h.nominal_unit) : null,
        tolerance: h.tolerance || null
      };
    };
    const newServices = (editData.services || []).filter(s => s.serviceId).map(s => {
      const techRows = (s.technicians || []).filter((t) => t.technicianId);
      const technicians = techRows.map((t) => ({
        technicianId: parseInt(t.technicianId, 10),
        shift: t.shift === SHIFT_NIGHT ? SHIFT_NIGHT : SHIFT_DAY
      }));
      const components = mapComponentsToPayload(
        s.components?.length
          ? s.components
          : [{ componentId: generalComponentId, housingCount: s.housingCount, housings: s.housings }],
        needsOrderHousings
      );
      return {
        serviceId: parseInt(s.serviceId, 10),
        housingCount: totalHousingCount(s.components || []),
        technicians,
        components
      };
    });
    // Incluir siempre servicios si hay filas: evita 400 "No fields to update" cuando el stringify
    // no detecta cambios pese a ediciones en alojamientos/medidas nominales.
    if (newServices.length > 0) {
      for (const ns of newServices) {
        if (!ns.technicians || ns.technicians.length === 0) {
          showError('Cada servicio debe tener al menos un técnico con turno (Día/DS o Noche/NS).');
          return;
        }
      }
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

  const openPhotoEdit = (photo) => {
    setEditingPhoto(photo);
    setPhotoEditData({
      workOrderServiceId: photo.work_order_service_id ? String(photo.work_order_service_id) : '',
      photoType: photo.photo_type || 'during_service',
      description: photo.description || ''
    });
  };

  const closePhotoEdit = () => {
    if (photoEditSaving) return;
    setEditingPhoto(null);
    setPhotoEditData({ workOrderServiceId: '', photoType: 'during_service', description: '' });
  };

  const savePhotoEdit = async (e) => {
    e.preventDefault();
    if (!editingPhoto) return;
    const serviceCount = (order?.services || []).filter((s) => s.id).length;
    if (serviceCount > 1 && !photoEditData.workOrderServiceId) {
      showError('Seleccione el servicio al que corresponde la foto.');
      return;
    }
    setPhotoEditSaving(true);
    try {
      await api.put(`/work-orders/${id}/photos/${editingPhoto.id}`, {
        workOrderServiceId: photoEditData.workOrderServiceId || null,
        photoType: photoEditData.photoType || 'during_service',
        description: photoEditData.description || ''
      });
      showSuccess('Foto actualizada');
      closePhotoEdit();
      fetchOrder();
    } catch (err) {
      showError(err.response?.data?.error || 'Error al actualizar la foto');
    } finally {
      setPhotoEditSaving(false);
    }
  };

  const submitAdminPhoto = async (e) => {
    e.preventDefault();
    const form = e.target;
    const file = form.photo?.files?.[0];
    if (!file) {
      showError('Seleccione una imagen.');
      return;
    }
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('photoType', form.photoType?.value || 'during_service');
    fd.append('description', form.description?.value || '');
    const wosVal = form.workOrderServiceId?.value;
    if (wosVal) fd.append('workOrderServiceId', wosVal);
    setAdminPhotoUploading(true);
    try {
      await api.post(`/work-orders/${id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showSuccess('Foto subida');
      form.reset();
      fetchOrder();
    } catch (err) {
      showError(err.response?.data?.error || 'Error al subir la foto');
    } finally {
      setAdminPhotoUploading(false);
    }
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

  const workingDays = getWorkingDaysCount(order);
  const showHousingMetrology = isMachiningRepairByTypeName(order.service_type_name);

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
      let msg = 'Error al descargar el reporte PDF';
      const data = e.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const j = JSON.parse(text);
          if (j?.error) msg = j.error;
        } catch (_) {
          /* keep default */
        }
      } else if (typeof data?.error === 'string') {
        msg = data.error;
      }
      showError(msg);
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
          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownloadReport}
            title="Descargar reporte en PDF (fecha de completación en cabecera si está registrada)"
          >
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
          className={activeTab === 'firma' ? 'active' : ''}
          onClick={() => setActiveTab('firma')}
        >
          Firma
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
                  <select
                    value={editData.locationId}
                    onChange={(e) => setEditData({ ...editData, locationId: e.target.value })}
                  >
                    <option value="">Seleccionar ubicación</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                ) : (
                  <p>{order.location_name || order.service_location || 'No especificada'}</p>
                )}
              </div>

              <div className="info-item">
                <label>Tipo de Servicio</label>
                {editMode ? (
                  <select
                    value={editData.serviceTypeId}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setEditData((prev) => {
                        const next = { ...prev, serviceTypeId: nextType };
                        if (!isMachiningRepairServiceType(serviceTypes, nextType)) {
                          next.services = (prev.services || []).map((os) => ({
                            ...os,
                            housingCount: 0,
                            housings: [],
                            technicians: os.technicians?.length ? os.technicians : [{ technicianId: '', shift: SHIFT_DAY }]
                          }));
                        }
                        return next;
                      });
                      if (!isMachiningRepairServiceType(serviceTypes, nextType)) {
                        setShowHousingsModal(false);
                        setEditingServiceIdx(null);
                      }
                    }}
                  >
                    <option value="">Seleccionar tipo</option>
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                ) : (
                  <p>{order.service_type_name || 'No especificado'}</p>
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
                <label>Técnicos</label>
                {!editMode ? (
                  <p style={{ margin: 0 }}>{order.technician_name || '—'}</p>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: '#6e6b7b' }}>
                    Asigne técnicos y turno por cada servicio en la sección Servicios.
                  </p>
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
                      <div key={idx} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #eceaf0' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div style={{ flex: '2 1 200px', minWidth: 0 }}>
                            <SearchableSelect
                              value={os.serviceId}
                              onChange={(val) => {
                                const next = [...(editData.services || [])];
                                next[idx] = { ...next[idx], serviceId: val };
                                setEditData({ ...editData, services: next });
                              }}
                              options={servicesForOrder
                                .filter(s => !(editData.services || []).some((o, i) => i !== idx && o.serviceId === String(s.id)))
                                .map((s) => ({ value: String(s.id), label: `${s.code} - ${s.name}` }))}
                              placeholder="Seleccionar servicio..."
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
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
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#5c5966' }}>Técnicos y turno</span>
                          {(os.technicians || [{ technicianId: '', shift: SHIFT_DAY }]).map((t, ti) => (
                            <div key={ti} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                              <select
                                value={t.technicianId}
                                onChange={(e) => updateEditTechnician(idx, ti, 'technicianId', e.target.value)}
                                style={{ flex: '2 1 180px', minWidth: 140 }}
                              >
                                <option value="">Seleccionar técnico</option>
                                {technicians.map((tech) => (
                                  <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                                ))}
                              </select>
                              <select
                                value={t.shift === SHIFT_NIGHT ? SHIFT_NIGHT : SHIFT_DAY}
                                onChange={(e) => updateEditTechnician(idx, ti, 'shift', e.target.value)}
                                style={{ flex: '1 1 140px', minWidth: 120 }}
                              >
                                <option value={SHIFT_DAY}>{shiftLabel(SHIFT_DAY)}</option>
                                <option value={SHIFT_NIGHT}>{shiftLabel(SHIFT_NIGHT)}</option>
                              </select>
                              <button type="button" className="btn-secondary" style={{ padding: '6px 10px' }} onClick={() => removeEditTechnicianRow(idx, ti)} title="Quitar técnico">−</button>
                            </div>
                          ))}
                          <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => addEditTechnicianRow(idx)}>
                            + Agregar técnico
                          </button>
                        </div>
                        <WorkOrderServiceComponentsEditor
                          components={os.components || []}
                          componentsCatalog={componentsCatalog}
                          needsOrderHousings={needsOrderHousings}
                          generalComponentId={generalComponentId}
                          createDefaultComponent={createDefaultComponent}
                          onUpdateComponent={(ci, field, value) => updateServiceComponent(idx, ci, field, value)}
                          onAddComponent={() => addComponentToService(idx)}
                          onRemoveComponent={(ci) => removeComponentFromService(idx, ci)}
                          onOpenHousingsModal={(ci) => openHousingsModalForComponent(idx, ci)}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setEditData({
                        ...editData,
                        services: [...(editData.services || []), { serviceId: '', housingCount: 0, components: [createDefaultComponent(generalComponentId)], technicians: [{ technicianId: '', shift: SHIFT_DAY }] }]
                      })}
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
                            <strong>{s.service_code} {s.service_name}</strong>
                            {isMachiningRepairByTypeName(order.service_type_name)
                              ? ` — ${((s.housings || []).length || s.housing_count || 0)} alojamiento(s)`
                              : ''}
                            {(s.components || []).length > 0 && (
                              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontWeight: 'normal', fontSize: 13 }}>
                                {(s.components || []).map((c, ci) => (
                                  <li key={ci}>
                                    {c.component_name || 'Componente'}
                                    {isMachiningRepairByTypeName(order.service_type_name)
                                      ? ` (${(c.housings || []).length || c.housing_count || 0} aloj.)`
                                      : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {(s.technicians || []).length > 0 && (
                              <div style={{ marginTop: 4, fontSize: 13, color: '#4a4752' }}>
                                {(s.technicians || []).map((t, j) => (
                                  <span key={j}>
                                    {j > 0 ? '; ' : ''}
                                    {t.full_name} ({shiftLabel(t.shift)})
                                  </span>
                                ))}
                              </div>
                            )}
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
                {editMode ? (
                  <input
                    type="datetime-local"
                    value={editData.startDate}
                    onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                  />
                ) : (
                  <p>{order.start_date 
                    ? new Date(order.start_date).toLocaleString('es-PA')
                    : 'No iniciada'}</p>
                )}
              </div>

              <div className="info-item">
                <label>Fecha de Completación</label>
                {editMode ? (
                  <input
                    type="datetime-local"
                    value={editData.completionDate}
                    onChange={(e) => setEditData({ ...editData, completionDate: e.target.value })}
                  />
                ) : (
                  <p>{order.completion_date 
                    ? new Date(order.completion_date).toLocaleString('es-PA')
                    : 'No completada'}</p>
                )}
              </div>

              {workingDays !== null && (
                <div className="info-item">
                  <label>Días Trabajados</label>
                  <p className="working-days-hint" style={{ fontSize: 12, color: 'var(--text-light)', margin: '0 0 6px' }}>
                    Calculado desde la fecha de inicio hasta hoy, o hasta la fecha de completación si está registrada.
                  </p>
                  <p style={{ fontWeight: 600, color: order.completion_date ? '#4CAF50' : '#2196F3' }}>
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
                  className="description-full-width"
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

                    {showHousingMetrology && hasHousings ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Servicio</th>
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
                                <td style={{ maxWidth: 240 }}>
                                  {[hm.service_code, hm.service_name].filter(Boolean).join(' — ') || '—'}
                                </td>
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
                        {showHousingMetrology && !hasHousings && (
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

                    {showHousingMetrology && hasHousings ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Servicio</th>
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
                                <td style={{ maxWidth: 240 }}>
                                  {[hm.service_code, hm.service_name].filter(Boolean).join(' — ') || '—'}
                                </td>
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
                        {showHousingMetrology && !hasHousings && (
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
            <form onSubmit={submitAdminPhoto} className="admin-photo-upload-form" style={{ marginBottom: 20, padding: 16, background: 'var(--card-bg, #fff)', borderRadius: 8, border: '1px solid var(--border-color, #e5e2eb)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Subir foto</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="admin-photo-file">Archivo</label>
                  <input id="admin-photo-file" name="photo" type="file" accept="image/*" required />
                </div>
                {(order.services || []).filter((s) => s.id).length > 1 && (
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
                    <label htmlFor="admin-photo-service">Servicio</label>
                    <select id="admin-photo-service" name="workOrderServiceId" required>
                      <option value="">Seleccione…</option>
                      {(order.services || []).filter((s) => s.id).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.service_code ? `${s.service_code} — ` : ''}{s.service_name || 'Servicio'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="admin-photo-type">Tipo</label>
                  <select id="admin-photo-type" name="photoType" defaultValue="during_service">
                    <option value="inspection">Inspección</option>
                    <option value="during_service">Durante el servicio</option>
                    <option value="completion">Finalización</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
                  <label htmlFor="admin-photo-desc">Descripción</label>
                  <input id="admin-photo-desc" name="description" type="text" placeholder="Opcional" />
                </div>
                <button type="submit" className="btn-primary" disabled={adminPhotoUploading}>
                  {adminPhotoUploading ? 'Subiendo…' : 'Subir'}
                </button>
              </div>
              {(order.services || []).filter((s) => s.id).length <= 1 && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-light)' }}>
                  Con un solo servicio en la OT, la foto se asocia automáticamente a ese servicio.
                </p>
              )}
            </form>
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
                    {photo.photo_service_name || photo.photo_service_code ? (
                      <p style={{ fontSize: 12, fontWeight: 600, margin: '4px 0 0' }}>
                        Servicio: {photo.photo_service_code ? `${photo.photo_service_code} — ` : ''}{photo.photo_service_name || '—'}
                      </p>
                    ) : null}
                    <p style={{ fontSize: 12, margin: '0' }}>
                      Tipo: {photo.photo_type === 'inspection' ? 'Inspección' : photo.photo_type === 'completion' ? 'Finalización' : 'Durante el servicio'}
                    </p>
                    <p>{photo.description || 'Sin descripción'}</p>
                    <div className="photo-actions">
                      <button
                        type="button"
                        className="photo-action-btn"
                        onClick={(e) => { e.stopPropagation(); openPhotoEdit(photo); }}
                        title="Editar foto"
                        aria-label="Editar foto"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L10 16l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="photo-action-btn photo-delete-btn"
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
                      </button>
                    </div>
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

            {editingPhoto && (
              <div className="modal-overlay" onClick={closePhotoEdit}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
                  <h2>Editar foto</h2>
                  <form onSubmit={savePhotoEdit}>
                    {(order.services || []).filter((s) => s.id).length > 1 && (
                      <div className="form-group">
                        <label htmlFor="edit-photo-service">Servicio</label>
                        <select
                          id="edit-photo-service"
                          value={photoEditData.workOrderServiceId}
                          onChange={(e) => setPhotoEditData((prev) => ({ ...prev, workOrderServiceId: e.target.value }))}
                          required
                        >
                          <option value="">Seleccione…</option>
                          {(order.services || []).filter((s) => s.id).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.service_code ? `${s.service_code} — ` : ''}{s.service_name || 'Servicio'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="form-group">
                      <label htmlFor="edit-photo-type">Tipo</label>
                      <select
                        id="edit-photo-type"
                        value={photoEditData.photoType}
                        onChange={(e) => setPhotoEditData((prev) => ({ ...prev, photoType: e.target.value }))}
                      >
                        <option value="inspection">Inspección</option>
                        <option value="during_service">Durante el servicio</option>
                        <option value="completion">Finalización</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="edit-photo-description">Descripción</label>
                      <textarea
                        id="edit-photo-description"
                        rows={3}
                        value={photoEditData.description}
                        onChange={(e) => setPhotoEditData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Descripción de la foto"
                      />
                    </div>
                    <div className="modal-actions">
                      <button type="button" onClick={closePhotoEdit} disabled={photoEditSaving}>Cancelar</button>
                      <button type="submit" className="btn-primary" disabled={photoEditSaving}>
                        {photoEditSaving ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </form>
                </div>
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
                          <button
                            type="button"
                            className="document-link"
                            onClick={() => {
                              openWorkOrderDocumentInNewTab(id, doc).catch((err) => {
                                showError(err?.message || 'Error al abrir el documento');
                              });
                            }}
                          >
                            {docTypeLabel} {doc.file_name}
                          </button>
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
                  <p>
                    ☑️ Marque los documentos que el técnico podrá ver en esta OT. Los planos marcados se incluyen en el
                    reporte PDF: imágenes en la sección &quot;Planos / Documentos&quot;; archivos PDF se listan ahí y sus
                    páginas se anexan al final del reporte.
                  </p>
                </div>
              </>
            ) : (
              <p className="empty-message">No hay documentos</p>
            )}
          </div>
        )}

        {activeTab === 'firma' && order && (
          <div className="firma-section" style={{ maxWidth: 640 }}>
            <h3>Firma del Superintendente</h3>
            <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Adjunte aquí la imagen de la firma del superintendente (por ejemplo, la recibida por correo). Solo aparecerá en el reporte PDF cuando exista una imagen cargada.
            </p>
            {order.superintendent_signature_path ? (
              <div style={{ marginBottom: 20 }}>
                <img
                  src={getStaticUrl(order.superintendent_signature_path)}
                  alt="Firma del superintendente"
                  style={{ maxWidth: '100%', maxHeight: 220, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}
                />
                {order.superintendent_signature_signed_by && (
                  <p style={{ marginTop: 8, marginBottom: 0 }}>
                    <strong>Nombre:</strong> {order.superintendent_signature_signed_by}
                  </p>
                )}
                {order.superintendent_signature_signed_at && (
                  <p style={{ marginTop: 4, marginBottom: 0, color: 'var(--text-light)', fontSize: 14 }}>
                    {new Date(order.superintendent_signature_signed_at).toLocaleString('es-PA')}
                  </p>
                )}
              </div>
            ) : (
              <p className="empty-message" style={{ marginBottom: 16 }}>Aún no hay imagen adjunta.</p>
            )}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Nombre en el reporte (opcional)</label>
              <input
                type="text"
                value={superintendentSigSignedBy}
                onChange={(e) => setSuperintendentSigSignedBy(e.target.value)}
                placeholder="Ej: nombre del superintendente"
                style={{ width: '100%', maxWidth: 400, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
            <input type="file" accept="image/*" id="superintendent-sig-file" style={{ marginBottom: 12, display: 'block' }} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                disabled={superintendentSigUploading}
                onClick={async () => {
                  const input = document.getElementById('superintendent-sig-file');
                  const file = input?.files?.[0];
                  if (!file) {
                    showError('Seleccione un archivo de imagen');
                    return;
                  }
                  setSuperintendentSigUploading(true);
                  try {
                    const fd = new FormData();
                    fd.append('superintendent_signature', file);
                    if (superintendentSigSignedBy.trim()) fd.append('signedBy', superintendentSigSignedBy.trim());
                    await api.post(`/work-orders/${id}/superintendent-signature`, fd, {
                      headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    showSuccess('Firma del superintendente guardada');
                    fetchOrder();
                    if (input) input.value = '';
                  } catch (e) {
                    showError(e.response?.data?.error || 'Error al subir la imagen');
                  } finally {
                    setSuperintendentSigUploading(false);
                  }
                }}
              >
                {superintendentSigUploading ? 'Subiendo...' : order.superintendent_signature_path ? 'Reemplazar imagen' : 'Subir imagen'}
              </button>
              {order.superintendent_signature_path && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    showConfirm('¿Eliminar la imagen de firma del superintendente?', async () => {
                      try {
                        await api.delete(`/work-orders/${id}/superintendent-signature`);
                        showSuccess('Imagen eliminada');
                        fetchOrder();
                      } catch (e) {
                        showError(e.response?.data?.error || 'Error al eliminar');
                      }
                    });
                  }}
                >
                  Eliminar imagen
                </button>
              )}
            </div>
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

      {needsOrderHousings && showHousingsModal && editingServiceIdx !== null && editingComponentIdx !== null && editMode && (
        <div className="modal-overlay" onClick={() => closeHousingsModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 'min(96vw, 1280px)', width: '100%' }}
          >
            <h2>Alojamientos — {(services.find(s => s.id === parseInt((editData.services || [])[editingServiceIdx]?.serviceId))?.name || 'Servicio')}</h2>
            <p style={{ marginTop: -8, color: '#6e6b7b' }}>
              Complete la información de cada alojamiento. Cada componente comienza con A, B, C...
            </p>
            <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
              <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '7%' }}>Medida</th>
                    <th style={{ width: '32%' }}>Descripción</th>
                    <th style={{ width: '12%' }}>Medida Nominal</th>
                    <th style={{ width: '18%' }}>Tolerancia</th>
                    <th style={{ width: '12%' }}>Unidad</th>
                    <th style={{ width: 100 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {((editData.services || [])[editingServiceIdx]?.components?.[editingComponentIdx]?.housings || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '1rem', color: 'var(--text-light)', textAlign: 'center' }}>
                        No hay alojamientos. Ajuste la cantidad en la lista de servicios o cierre este cuadro.
                      </td>
                    </tr>
                  ) : null}
                  {((editData.services || [])[editingServiceIdx]?.components?.[editingComponentIdx]?.housings || []).map((h, idx) => (
                    <tr key={(h.measureCode || 'm') + '-' + idx}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 700, verticalAlign: 'middle' }}>{h.measureCode}</td>
                      <td>
                        <input
                          value={h.description || ''}
                          onChange={(e) => updateEditHousing(idx, 'description', e.target.value)}
                          placeholder="Descripción del alojamiento"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.001"
                          value={h.nominalValue ?? ''}
                          onChange={(e) => updateEditHousing(idx, 'nominalValue', e.target.value)}
                          placeholder="0.000"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={h.tolerance || ''}
                          onChange={(e) => updateEditHousing(idx, 'tolerance', e.target.value)}
                          placeholder="+0.5, -0.3, ±0.2"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </td>
                      <td>
                        <input
                          value={h.nominalUnit || ''}
                          onChange={(e) => updateEditHousing(idx, 'nominalUnit', e.target.value)}
                          placeholder="mm, in, etc."
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => removeEditHousingRow(idx)}
                          title="Eliminar este alojamiento"
                          style={{
                            padding: '4px 8px',
                            fontSize: 13,
                            color: '#b91c1c',
                            borderColor: '#fecaca',
                            background: '#fef2f2',
                          }}
                        >
                          Eliminar
                        </button>
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
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 'min(96vw, 1280px)', width: '100%' }}
          >
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
            {showHousingMetrology ? (
            <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
              <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Servicio</th>
                    <th style={{ width: '6%' }}>Medida</th>
                    <th style={{ width: '18%' }}>Descripción</th>
                    <th style={{ width: '11%' }}>X1</th>
                    <th style={{ width: '11%' }}>Y1</th>
                    <th style={{ width: '8%' }}>Unidad</th>
                    <th style={{ width: 100 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {editMeasurementForm.housingMeasurements.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '1rem', color: 'var(--text-light)', textAlign: 'center' }}>
                        No hay filas. Cierre y vuelva a abrir la medición o guarde para dejar la medición sin alojamientos.
                      </td>
                    </tr>
                  ) : null}
                  {editMeasurementForm.housingMeasurements.map((hm, idx) => (
                    <tr key={`${hm.housingId ?? 'h'}-${idx}`}>
                      <td style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>
                        {[hm.service_code, hm.service_name].filter(Boolean).join(' — ') || '—'}
                      </td>
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
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => removeEditMeasurementRow(idx)}
                          disabled={savingMeasurement}
                          title="Quitar esta fila de la medición"
                          style={{
                            padding: '4px 8px',
                            fontSize: 13,
                            color: '#b91c1c',
                            borderColor: '#fecaca',
                            background: '#fef2f2',
                          }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : (
              <p style={{ color: 'var(--text-light)', marginBottom: 0 }}>
                Para este tipo de servicio no se editan medidas por alojamiento; solo observaciones.
              </p>
            )}
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


