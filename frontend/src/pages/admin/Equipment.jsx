import { useState, useEffect } from 'react';
import api from '../../services/api';
import { getStaticUrl } from '../../config.js';
import { EditIcon, DeleteIcon, SearchIcon } from '../../components/Icons';
import { useAlert } from '../../hooks/useAlert';
import AlertDialog from '../../components/AlertDialog';
import './Management.css';

export default function Equipment() {
  const [activeTab, setActiveTab] = useState('equipment'); // 'brands', 'models', 'housings', 'equipment', 'documents'
  
  // Brands state
  const [brands, setBrands] = useState([]);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [brandFormData, setBrandFormData] = useState({ name: '' });
  const [editingBrand, setEditingBrand] = useState(null);

  // Models state
  const [models, setModels] = useState([]);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelFormData, setModelFormData] = useState({ brandId: '', modelName: '', components: '' });
  const [editingModel, setEditingModel] = useState(null);

  // Housings state
  const [housings, setHousings] = useState([]);
  const [showHousingModal, setShowHousingModal] = useState(false);
  const [housingFormData, setHousingFormData] = useState({ modelId: '', housingName: '', description: '' });
  const [editingHousing, setEditingHousing] = useState(null);
  const [selectedModelIdForHousing, setSelectedModelIdForHousing] = useState('');

  // Equipment state
  const [equipment, setEquipment] = useState([]);
  const [clients, setClients] = useState([]);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [equipmentFormData, setEquipmentFormData] = useState({ 
    modelId: '', 
    housingId: '',
    serialNumber: '', 
    clientId: '', 
    description: '' 
  });
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [selectedBrandId, setSelectedBrandId] = useState(''); // Para filtrar modelos por marca
  const [equipmentModalBrandId, setEquipmentModalBrandId] = useState(''); // Para el modal de equipos
  const [equipmentModalModelId, setEquipmentModalModelId] = useState(''); // Para filtrar alojamientos por modelo

  // Documents state
  const [equipmentDocuments, setEquipmentDocuments] = useState([]);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentFormData, setDocumentFormData] = useState({
    brandId: '',
    modelId: '',
    documentType: 'manual',
    description: ''
  });
  const [documentFile, setDocumentFile] = useState(null);
  const [documentFiles, setDocumentFiles] = useState([]);

  // Filters
  const [brandFilter, setBrandFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [housingFilter, setHousingFilter] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('');

  const [loading, setLoading] = useState(true);

  // Alert Dialog
  const { alertDialog, showError, showSuccess, showWarning, showConfirm, closeAlert } = useAlert();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'models' || activeTab === 'equipment' || activeTab === 'housings' || activeTab === 'documents') {
      fetchBrands();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedBrandId) {
      fetchModels(selectedBrandId);
    } else {
      fetchModels();
    }
  }, [selectedBrandId, activeTab]);

  useEffect(() => {
    if (selectedModelIdForHousing) {
      fetchHousings(selectedModelIdForHousing);
    } else {
      fetchHousings();
    }
  }, [selectedModelIdForHousing, activeTab]);

  useEffect(() => {
    if (equipmentModalModelId) {
      fetchHousings(equipmentModalModelId);
    }
  }, [equipmentModalModelId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'brands') {
        const response = await api.get('/equipment/brands');
        setBrands(response.data);
      } else if (activeTab === 'models') {
        await fetchModels();
      } else if (activeTab === 'housings') {
        await fetchHousings();
      } else if (activeTab === 'equipment') {
        await fetchEquipment();
        const clientsRes = await api.get('/clients');
        setClients(clientsRes.data);
      } else if (activeTab === 'documents') {
        await fetchEquipmentDocuments();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await api.get('/equipment/brands');
      setBrands(response.data);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const fetchModels = async (brandId = null) => {
    try {
      const url = brandId ? `/equipment/models?brandId=${brandId}` : '/equipment/models';
      const response = await api.get(url);
      setModels(response.data);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const fetchHousings = async (modelId = null) => {
    try {
      const url = modelId ? `/equipment/housings?modelId=${modelId}` : '/equipment/housings';
      const response = await api.get(url);
      setHousings(response.data);
    } catch (error) {
      console.error('Error fetching housings:', error);
    }
  };

  const fetchEquipment = async () => {
    try {
      const response = await api.get('/equipment');
      setEquipment(response.data);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  };

  const fetchEquipmentDocuments = async () => {
    try {
      const response = await api.get('/equipment/documents');
      setEquipmentDocuments(response.data);
    } catch (error) {
      console.error('Error fetching equipment documents:', error);
      showError('Error al cargar los documentos de equipos');
    }
  };

  // Brands handlers
  const handleBrandSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBrand) {
        await api.put(`/equipment/brands/${editingBrand.id}`, brandFormData);
      } else {
        await api.post('/equipment/brands', brandFormData);
      }
      setShowBrandModal(false);
      setBrandFormData({ name: '' });
      setEditingBrand(null);
      fetchBrands();
    } catch (error) {
      showError(error.response?.data?.error || 'Error al guardar la marca');
    }
  };

  // Models handlers
  const handleModelSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        brandId: parseInt(modelFormData.brandId),
        modelName: modelFormData.modelName,
        components: modelFormData.components || null
      };
      if (editingModel) {
        await api.put(`/equipment/models/${editingModel.id}`, payload);
      } else {
        await api.post('/equipment/models', payload);
      }
      setShowModelModal(false);
      setModelFormData({ brandId: '', modelName: '', components: '' });
      setEditingModel(null);
      fetchModels(selectedBrandId || null);
    } catch (error) {
      showError(error.response?.data?.error || 'Error al guardar el modelo');
    }
  };

  // Housings handlers
  const handleHousingSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        modelId: parseInt(housingFormData.modelId),
        housingName: housingFormData.housingName,
        description: housingFormData.description || null
      };
      if (editingHousing) {
        await api.put(`/equipment/housings/${editingHousing.id}`, payload);
      } else {
        await api.post('/equipment/housings', payload);
      }
      setShowHousingModal(false);
      setHousingFormData({ modelId: '', housingName: '', description: '' });
      setEditingHousing(null);
      fetchHousings(selectedModelIdForHousing || null);
    } catch (error) {
      showError(error.response?.data?.error || 'Error al guardar el alojamiento');
    }
  };

  const handleEditHousing = (housing) => {
    setEditingHousing(housing);
    setHousingFormData({
      modelId: housing.model_id.toString(),
      housingName: housing.housing_name,
      description: housing.description || ''
    });
    setShowHousingModal(true);
  };

  const handleDeleteHousing = async (id) => {
    showConfirm('¿Está seguro de desactivar este alojamiento?', async () => {
      try {
        await api.put(`/equipment/housings/${id}`, { isActive: false });
        fetchHousings(selectedModelIdForHousing || null);
      } catch (error) {
        showError('Error al desactivar el alojamiento');
      }
    });
  };

  // Documents handlers
  const handleDocumentSubmit = async (e) => {
    e.preventDefault();
    if (!documentFiles || documentFiles.length === 0) {
      showWarning('Por favor seleccione al menos un archivo', 'Archivo requerido');
      return;
    }
    try {
      // Subir cada archivo individualmente
      const uploadPromises = Array.from(documentFiles).map(async (file) => {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('brandId', documentFormData.brandId || '');
        formData.append('modelId', documentFormData.modelId || '');
        formData.append('documentType', documentFormData.documentType);
        formData.append('description', documentFormData.description || '');

        return api.post('/equipment/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      });

      await Promise.all(uploadPromises);
      
      setShowDocumentModal(false);
      setDocumentFormData({ brandId: '', modelId: '', documentType: 'manual', description: '' });
      setDocumentFiles([]);
      setDocumentFile(null);
      fetchEquipmentDocuments();
      showSuccess(`${documentFiles.length} documento(s) subido(s) correctamente`);
    } catch (error) {
      showError(error.response?.data?.error || 'Error al subir los documentos');
    }
  };

  const handleDeleteDocument = async (id) => {
    showConfirm('¿Está seguro de eliminar este documento?', async () => {
      try {
        await api.delete(`/equipment/documents/${id}`);
        fetchEquipmentDocuments();
      } catch (error) {
        showError('Error al eliminar el documento');
      }
    });
  };

  // Equipment handlers
  const handleEquipmentSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        modelId: parseInt(equipmentFormData.modelId),
        housingId: equipmentFormData.housingId ? parseInt(equipmentFormData.housingId) : null,
        serialNumber: equipmentFormData.serialNumber,
        clientId: equipmentFormData.clientId ? parseInt(equipmentFormData.clientId) : null,
        description: equipmentFormData.description || null
      };
      if (editingEquipment) {
        await api.put(`/equipment/${editingEquipment.id}`, payload);
      } else {
        await api.post('/equipment', payload);
      }
      setShowEquipmentModal(false);
      setEquipmentFormData({ modelId: '', housingId: '', serialNumber: '', clientId: '', description: '' });
      setEditingEquipment(null);
      setEquipmentModalBrandId('');
      fetchEquipment();
    } catch (error) {
      showError(error.response?.data?.error || 'Error al guardar el equipo');
    }
  };

  const handleOpenEquipmentModal = async (equipment = null) => {
    if (equipment) {
      // Si estamos editando, necesitamos obtener la marca del modelo
      const equipmentModel = models.find(m => m.id === equipment.model_id);
      const brandId = equipmentModel?.brand_id || equipment.brand_id || '';
      setEquipmentModalBrandId(brandId);
      if (brandId) {
        await fetchModels(brandId);
      }
      setEquipmentFormData({
        modelId: equipment.model_id,
        housingId: equipment.housing_id || '',
        serialNumber: equipment.serial_number,
        clientId: equipment.client_id || '',
        description: equipment.description || ''
      });
      setEditingEquipment(equipment);
    } else {
      setEquipmentFormData({ modelId: '', housingId: '', serialNumber: '', clientId: '', description: '' });
      setEditingEquipment(null);
      setEquipmentModalBrandId('');
    }
    setShowEquipmentModal(true);
  };

  const handleDeleteEquipment = async (id) => {
    showConfirm('¿Está seguro de desactivar este equipo?', async () => {
      try {
        await api.delete(`/equipment/${id}`);
        fetchEquipment();
      } catch (error) {
        showError('Error al desactivar el equipo');
      }
    });
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Gestión de Equipos</h1>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={activeTab === 'brands' ? 'tab-active' : 'tab'} 
          onClick={() => setActiveTab('brands')}
        >
          Marcas
        </button>
        <button 
          className={activeTab === 'models' ? 'tab-active' : 'tab'} 
          onClick={() => setActiveTab('models')}
        >
          Modelos
        </button>
        <button 
          className={activeTab === 'housings' ? 'tab-active' : 'tab'} 
          onClick={() => setActiveTab('housings')}
        >
          Alojamientos
        </button>
        <button 
          className={activeTab === 'equipment' ? 'tab-active' : 'tab'} 
          onClick={() => setActiveTab('equipment')}
        >
          Equipos
        </button>
        <button 
          className={activeTab === 'documents' ? 'tab-active' : 'tab'} 
          onClick={() => setActiveTab('documents')}
        >
          Documentación
        </button>
      </div>

      {/* Brands Tab */}
      {activeTab === 'brands' && (
        <>
          <div className="table-header">
            <div className="table-filters">
              <div className="search-input-wrapper">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Buscar marca..."
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="table-header-actions">
              <button onClick={() => { setEditingBrand(null); setBrandFormData({ name: '' }); setShowBrandModal(true); }} className="btn-primary">
                + Nueva Marca
              </button>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {brands
                  .filter(brand => !brandFilter || brand.name.toLowerCase().includes(brandFilter.toLowerCase()))
                  .map(brand => (
                  <tr key={brand.id}>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => { setEditingBrand(brand); setBrandFormData({ name: brand.name }); setShowBrandModal(true); }} 
                          className="action-btn action-btn-edit"
                          title="Editar"
                        >
                          <EditIcon size={16} />
                        </button>
                      </div>
                    </td>
                    <td>{brand.id}</td>
                    <td>{brand.name}</td>
                    <td>
                      <span className={`badge ${brand.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {brand.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Models Tab */}
      {activeTab === 'models' && (
        <>
          <div className="table-header">
            <div className="table-filters">
              <select 
                value={selectedBrandId} 
                onChange={(e) => setSelectedBrandId(e.target.value)}
              >
                <option value="">Todas las marcas</option>
                {brands.map(brand => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
              <div className="search-input-wrapper">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Buscar modelo..."
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="table-header-actions">
              <button onClick={() => { setEditingModel(null); setModelFormData({ brandId: '', modelName: '', components: '' }); setShowModelModal(true); }} className="btn-primary">
                + Nuevo Modelo
              </button>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>ID</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Componentes</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {models
                  .filter(model => {
                    if (selectedBrandId && model.brand_id !== parseInt(selectedBrandId)) return false;
                    if (modelFilter && !model.model_name.toLowerCase().includes(modelFilter.toLowerCase())) return false;
                    return true;
                  })
                  .map(model => (
                  <tr key={model.id}>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => { setEditingModel(model); setModelFormData({ brandId: model.brand_id, modelName: model.model_name, components: model.components || '' }); setShowModelModal(true); }} 
                          className="action-btn action-btn-edit"
                          title="Editar"
                        >
                          <EditIcon size={16} />
                        </button>
                      </div>
                    </td>
                    <td>{model.id}</td>
                    <td>{model.brand_name}</td>
                    <td>{model.model_name}</td>
                    <td>{model.components || '-'}</td>
                    <td>
                      <span className={`badge ${model.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {model.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <>
          <div className="table-header">
            <div className="table-filters">
              <div className="search-input-wrapper">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Buscar por serial, marca o modelo..."
                  value={equipmentFilter}
                  onChange={(e) => setEquipmentFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="table-header-actions">
              <button onClick={() => handleOpenEquipmentModal()} className="btn-primary">
                + Nuevo Equipo
              </button>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>Serial</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Componentes</th>
                  <th>Cliente</th>
                </tr>
              </thead>
              <tbody>
                {equipment
                  .filter(item => {
                    if (!equipmentFilter) return true;
                    const search = equipmentFilter.toLowerCase();
                    return item.serial_number?.toLowerCase().includes(search) ||
                           item.brand_name?.toLowerCase().includes(search) ||
                           item.model_name?.toLowerCase().includes(search);
                  })
                  .map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => handleOpenEquipmentModal(item)} 
                          className="action-btn action-btn-edit"
                          title="Editar"
                        >
                          <EditIcon size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteEquipment(item.id)} 
                          className="action-btn action-btn-delete"
                          title="Desactivar"
                        >
                          <DeleteIcon size={16} />
                        </button>
                      </div>
                    </td>
                    <td>{item.serial_number}</td>
                    <td>{item.brand_name}</td>
                    <td>{item.model_name}</td>
                    <td>{item.components || '-'}</td>
                    <td>{item.client_name || <span className="badge badge-gray">Sin asignar</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Housings Tab */}
      {activeTab === 'housings' && (
        <>
          <div className="table-header">
            <div className="table-filters">
              <select value={selectedModelIdForHousing} onChange={(e) => setSelectedModelIdForHousing(e.target.value)}>
                <option value="">Todos los modelos</option>
                {models.map(model => (
                  <option key={model.id} value={model.id}>{model.brand_name} - {model.model_name}</option>
                ))}
              </select>
              <div className="search-input-wrapper">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Buscar alojamiento..."
                  value={housingFilter}
                  onChange={(e) => setHousingFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="table-header-actions">
              <button onClick={() => {
                setEditingHousing(null);
                setHousingFormData({ modelId: '', housingName: '', description: '' });
                setShowHousingModal(true);
              }} className="btn-primary">+ Nuevo Alojamiento</button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Alojamiento</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {housings
                  .filter(housing => {
                    if (!housingFilter) return true;
                    const search = housingFilter.toLowerCase();
                    return housing.housing_name?.toLowerCase().includes(search) ||
                           housing.brand_name?.toLowerCase().includes(search) ||
                           housing.model_name?.toLowerCase().includes(search);
                  })
                  .map(housing => (
                    <tr key={housing.id}>
                      <td>
                        <div className="action-buttons">
                          <button onClick={() => handleEditHousing(housing)} className="action-btn action-btn-edit" title="Editar">
                            <EditIcon size={16} />
                          </button>
                          <button onClick={() => handleDeleteHousing(housing.id)} className="action-btn action-btn-delete" title="Desactivar">
                            <DeleteIcon size={16} />
                          </button>
                        </div>
                      </td>
                      <td>{housing.brand_name}</td>
                      <td>{housing.model_name}</td>
                      <td>{housing.housing_name}</td>
                      <td>{housing.description || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <>
          <div className="table-header">
            <div className="table-header-actions">
              <button onClick={() => {
                setDocumentFormData({ brandId: '', modelId: '', documentType: 'manual', description: '' });
                setDocumentFiles([]);
                setDocumentFile(null);
                setShowDocumentModal(true);
              }} className="btn-primary">+ Subir Documento</button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>Archivo</th>
                  <th>Tipo</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Alojamiento</th>
                  <th>Descripción</th>
                  <th>Tamaño</th>
                </tr>
              </thead>
              <tbody>
                {equipmentDocuments.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <div className="action-buttons">
                        <a href={getStaticUrl(doc.file_path)} target="_blank" rel="noopener noreferrer" className="action-btn action-btn-view" title="Ver">
                          👁️
                        </a>
                        <button onClick={() => handleDeleteDocument(doc.id)} className="action-btn action-btn-delete" title="Eliminar">
                          <DeleteIcon size={16} />
                        </button>
                      </div>
                    </td>
                    <td>{doc.file_name}</td>
                    <td>
                      {doc.document_type === 'manual' ? 'Manual' :
                       doc.document_type === 'blueprint' ? 'Plano' :
                       doc.document_type === 'specification' ? 'Especificación' : 'Otro'}
                    </td>
                    <td>{doc.brand_name || '-'}</td>
                    <td>{doc.model_name || '-'}</td>
                    <td>{doc.housing_name || '-'}</td>
                    <td>{doc.description || '-'}</td>
                    <td>{(doc.file_size / 1024).toFixed(2)} KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Brand Modal */}
      {showBrandModal && (
        <div className="modal-overlay" onClick={() => setShowBrandModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingBrand ? 'Editar Marca' : 'Nueva Marca'}</h2>
            <form onSubmit={handleBrandSubmit}>
              <input 
                placeholder="Nombre de la marca" 
                value={brandFormData.name} 
                onChange={(e) => setBrandFormData({...brandFormData, name: e.target.value})} 
                required 
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowBrandModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Model Modal */}
      {showModelModal && (
        <div className="modal-overlay" onClick={() => setShowModelModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingModel ? 'Editar Modelo' : 'Nuevo Modelo'}</h2>
            <form onSubmit={handleModelSubmit}>
              <select 
                value={modelFormData.brandId} 
                onChange={(e) => setModelFormData({...modelFormData, brandId: e.target.value})} 
                required
              >
                <option value="">Seleccionar Marca</option>
                {brands.map(brand => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
              <input 
                placeholder="Nombre del modelo" 
                value={modelFormData.modelName} 
                onChange={(e) => setModelFormData({...modelFormData, modelName: e.target.value})} 
                required 
              />
              <textarea 
                placeholder="Componentes (separados por comas)" 
                value={modelFormData.components} 
                onChange={(e) => setModelFormData({...modelFormData, components: e.target.value})} 
                rows="3"
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModelModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Equipment Modal */}
      {showEquipmentModal && (
        <div className="modal-overlay" onClick={() => setShowEquipmentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>{editingEquipment ? 'Editar Equipo' : 'Nuevo Equipo'}</h2>
            <form onSubmit={handleEquipmentSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label>Marca *</label>
                <select 
                  value={equipmentModalBrandId} 
                  onChange={async (e) => {
                    const brandId = e.target.value;
                    setEquipmentModalBrandId(brandId);
                    setEquipmentFormData({...equipmentFormData, modelId: ''});
                    if (brandId) {
                      await fetchModels(brandId);
                    }
                  }}
                  required
                >
                  <option value="">Seleccionar Marca</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Modelo *</label>
                <select 
                  value={equipmentFormData.modelId} 
                  onChange={async (e) => {
                    const modelId = e.target.value;
                    setEquipmentModalModelId(modelId);
                    setEquipmentFormData({...equipmentFormData, modelId, housingId: ''});
                    if (modelId) {
                      await fetchHousings(modelId);
                    }
                  }}
                  required
                  disabled={!equipmentModalBrandId}
                >
                  <option value="">{equipmentModalBrandId ? 'Seleccionar Modelo' : 'Primero seleccione una marca'}</option>
                  {models.filter(m => !equipmentModalBrandId || m.brand_id === parseInt(equipmentModalBrandId)).map(model => (
                    <option key={model.id} value={model.id}>{model.model_name}</option>
                  ))}
                </select>
              </div>
              <input 
                placeholder="Número de Serie *" 
                value={equipmentFormData.serialNumber} 
                onChange={(e) => setEquipmentFormData({...equipmentFormData, serialNumber: e.target.value})} 
                required 
              />
              <select 
                value={equipmentFormData.clientId} 
                onChange={(e) => setEquipmentFormData({...equipmentFormData, clientId: e.target.value})}
              >
                <option value="">Sin asignar cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea 
                placeholder="Descripción" 
                value={equipmentFormData.description} 
                onChange={(e) => setEquipmentFormData({...equipmentFormData, description: e.target.value})} 
                rows="3"
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowEquipmentModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Housing Modal */}
      {showHousingModal && (
        <div className="modal-overlay" onClick={() => setShowHousingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingHousing ? 'Editar Alojamiento' : 'Nuevo Alojamiento'}</h2>
            <form onSubmit={handleHousingSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label>Modelo *</label>
                <select 
                  value={housingFormData.modelId} 
                  onChange={(e) => setHousingFormData({...housingFormData, modelId: e.target.value})}
                  required
                >
                  <option value="">Seleccionar Modelo</option>
                  {models.map(model => (
                    <option key={model.id} value={model.id}>{model.brand_name} - {model.model_name}</option>
                  ))}
                </select>
              </div>
              <input 
                placeholder="Nombre del Alojamiento *" 
                value={housingFormData.housingName} 
                onChange={(e) => setHousingFormData({...housingFormData, housingName: e.target.value})} 
                required 
              />
              <textarea 
                placeholder="Descripción" 
                value={housingFormData.description} 
                onChange={(e) => setHousingFormData({...housingFormData, description: e.target.value})} 
                rows="3"
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowHousingModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Modal */}
      {showDocumentModal && (
        <div className="modal-overlay" onClick={() => setShowDocumentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>Subir Documento de Equipo</h2>
            <form onSubmit={handleDocumentSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label>Marca (Opcional)</label>
                <select 
                  value={documentFormData.brandId} 
                  onChange={(e) => setDocumentFormData({...documentFormData, brandId: e.target.value, modelId: ''})}
                >
                  <option value="">Seleccionar Marca</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Modelo (Opcional)</label>
                <select 
                  value={documentFormData.modelId} 
                  onChange={(e) => setDocumentFormData({...documentFormData, modelId: e.target.value})}
                  disabled={!documentFormData.brandId}
                >
                  <option value="">Seleccionar Modelo</option>
                  {models.filter(m => m.brand_id === parseInt(documentFormData.brandId)).map(model => (
                    <option key={model.id} value={model.id}>{model.model_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Tipo de Documento *</label>
                <select 
                  value={documentFormData.documentType} 
                  onChange={(e) => setDocumentFormData({...documentFormData, documentType: e.target.value})}
                  required
                >
                  <option value="manual">Manual Técnico</option>
                  <option value="blueprint">Plano</option>
                  <option value="specification">Especificación</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Archivo(s) *</label>
                <input 
                  type="file" 
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setDocumentFiles(files);
                    // Mantener compatibilidad con documentFile para el estado anterior
                    setDocumentFile(files.length > 0 ? files[0] : null);
                  }}
                  required
                />
                {documentFiles.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                    {documentFiles.length} archivo(s) seleccionado(s)
                  </div>
                )}
              </div>
              <textarea 
                placeholder="Descripción" 
                value={documentFormData.description} 
                onChange={(e) => setDocumentFormData({...documentFormData, description: e.target.value})} 
                rows="3"
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowDocumentModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Subir</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Dialog */}
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
