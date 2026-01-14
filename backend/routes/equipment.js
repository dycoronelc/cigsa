import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'documents'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Get all equipment brands
router.get('/brands', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [brands] = await pool.query(
      'SELECT * FROM equipment_brands WHERE is_active = TRUE ORDER BY name'
    );
    res.json(brands);
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create equipment brand
router.post('/brands', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'equipment_brand'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    const pool = await getConnection();
    const [result] = await pool.query(
      'INSERT INTO equipment_brands (name) VALUES (?)',
      [name]
    );

    res.status(201).json({ id: result.insertId, message: 'Brand created successfully' });
  } catch (error) {
    console.error('Create brand error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Brand name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update equipment brand
router.put('/brands/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'equipment_brand'), async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.params.id);
    await pool.query(`UPDATE equipment_brands SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    res.json({ message: 'Brand updated successfully' });
  } catch (error) {
    console.error('Update brand error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Brand name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get equipment models
router.get('/models', authenticateToken, async (req, res) => {
  try {
    const { brandId } = req.query;
    const pool = await getConnection();
    
    let query = `
      SELECT em.*, eb.name as brand_name 
      FROM equipment_models em 
      JOIN equipment_brands eb ON em.brand_id = eb.id 
      WHERE em.is_active = TRUE
    `;
    let params = [];

    if (brandId) {
      query += ' AND em.brand_id = ?';
      params.push(brandId);
    }

    query += ' ORDER BY eb.name, em.model_name';
    const [models] = await pool.query(query, params);
    res.json(models);
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create equipment model
router.post('/models', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'equipment_model'), async (req, res) => {
  try {
    const { brandId, modelName, components } = req.body;
    if (!brandId || !modelName) {
      return res.status(400).json({ error: 'Brand ID and model name are required' });
    }

    const pool = await getConnection();
    
    // Verify brand exists
    const [brand] = await pool.query('SELECT id FROM equipment_brands WHERE id = ? AND is_active = TRUE', [brandId]);
    if (brand.length === 0) {
      return res.status(400).json({ error: 'Invalid brand ID' });
    }

    const [result] = await pool.query(
      'INSERT INTO equipment_models (brand_id, model_name, components) VALUES (?, ?, ?)',
      [brandId, modelName, components || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Model created successfully' });
  } catch (error) {
    console.error('Create model error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'This brand and model combination already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update equipment model
router.put('/models/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'equipment_model'), async (req, res) => {
  try {
    const { brandId, modelName, components, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (brandId !== undefined) {
      // Verify brand exists
      const [brand] = await pool.query('SELECT id FROM equipment_brands WHERE id = ? AND is_active = TRUE', [brandId]);
      if (brand.length === 0) {
        return res.status(400).json({ error: 'Invalid brand ID' });
      }
      updateFields.push('brand_id = ?');
      updateValues.push(brandId);
    }
    if (modelName !== undefined) {
      updateFields.push('model_name = ?');
      updateValues.push(modelName);
    }
    if (components !== undefined) {
      updateFields.push('components = ?');
      updateValues.push(components);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.params.id);
    await pool.query(`UPDATE equipment_models SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    res.json({ message: 'Model updated successfully' });
  } catch (error) {
    console.error('Update model error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'This brand and model combination already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all equipment
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { clientId, modelId, brandId } = req.query;
    const pool = await getConnection();
    
    let query = `
      SELECT 
        e.*,
        em.model_name,
        em.components,
        eb.name as brand_name,
        eb.id as brand_id,
        eh.housing_name,
        eh.id as housing_id,
        c.name as client_name
      FROM equipment e
      JOIN equipment_models em ON e.model_id = em.id
      JOIN equipment_brands eb ON em.brand_id = eb.id
      LEFT JOIN equipment_housings eh ON e.housing_id = eh.id
      LEFT JOIN clients c ON e.client_id = c.id
      WHERE e.is_active = TRUE
    `;
    let params = [];

    if (clientId) {
      query += ' AND e.client_id = ?';
      params.push(clientId);
    }
    if (modelId) {
      query += ' AND e.model_id = ?';
      params.push(modelId);
    }
    if (brandId) {
      query += ' AND eb.id = ?';
      params.push(brandId);
    }

    query += ' ORDER BY eb.name, em.model_name, e.serial_number';
    const [equipment] = await pool.query(query, params);
    res.json(equipment);
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get equipment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [equipment] = await pool.query(
      `SELECT 
        e.*,
        em.model_name,
        em.components,
        eb.name as brand_name,
        eb.id as brand_id,
        eh.housing_name,
        eh.id as housing_id,
        c.name as client_name
      FROM equipment e
      JOIN equipment_models em ON e.model_id = em.id
      JOIN equipment_brands eb ON em.brand_id = eb.id
      LEFT JOIN equipment_housings eh ON e.housing_id = eh.id
      LEFT JOIN clients c ON e.client_id = c.id
      WHERE e.id = ?`,
      [req.params.id]
    );

    if (equipment.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Get documents associated with this equipment
    const [documents] = await pool.query(
      'SELECT * FROM work_order_documents WHERE equipment_id = ? ORDER BY created_at',
      [req.params.id]
    );

    res.json({
      ...equipment[0],
      documents
    });
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create equipment
router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'equipment'), async (req, res) => {
  try {
    const { modelId, housingId, serialNumber, clientId, location, description } = req.body;

    if (!modelId || !serialNumber) {
      return res.status(400).json({ error: 'Model ID and serial number are required' });
    }

    const pool = await getConnection();
    
    // Verificar que el modelo existe
    const [model] = await pool.query('SELECT id FROM equipment_models WHERE id = ? AND is_active = TRUE', [modelId]);
    if (model.length === 0) {
      return res.status(400).json({ error: 'Invalid model ID' });
    }

    // Verificar que el housing existe si se proporciona
    if (housingId) {
      const [housing] = await pool.query('SELECT id FROM equipment_housings WHERE id = ? AND is_active = TRUE', [housingId]);
      if (housing.length === 0) {
        return res.status(400).json({ error: 'Invalid housing ID' });
      }
    }

    // Verificar que el serial no existe
    const [existing] = await pool.query('SELECT id FROM equipment WHERE serial_number = ?', [serialNumber]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Serial number already exists' });
    }

    const [result] = await pool.query(
      'INSERT INTO equipment (model_id, housing_id, serial_number, client_id, location, description) VALUES (?, ?, ?, ?, ?, ?)',
      [modelId, housingId || null, serialNumber, clientId || null, location || null, description || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Equipment created successfully' });
  } catch (error) {
    console.error('Create equipment error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Serial number already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update equipment
router.put('/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'equipment'), async (req, res) => {
  try {
    const { modelId, housingId, serialNumber, clientId, location, description, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (modelId !== undefined) {
      // Verificar que el modelo existe
      const [model] = await pool.query('SELECT id FROM equipment_models WHERE id = ? AND is_active = TRUE', [modelId]);
      if (model.length === 0) {
        return res.status(400).json({ error: 'Invalid model ID' });
      }
      updateFields.push('model_id = ?');
      updateValues.push(modelId);
    }
    if (housingId !== undefined) {
      if (housingId) {
        // Verificar que el housing existe
        const [housing] = await pool.query('SELECT id FROM equipment_housings WHERE id = ? AND is_active = TRUE', [housingId]);
        if (housing.length === 0) {
          return res.status(400).json({ error: 'Invalid housing ID' });
        }
      }
      updateFields.push('housing_id = ?');
      updateValues.push(housingId || null);
    }
    if (serialNumber !== undefined) {
      // Verificar que el serial no existe en otro equipo
      const [existing] = await pool.query('SELECT id FROM equipment WHERE serial_number = ? AND id != ?', [serialNumber, req.params.id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Serial number already exists' });
      }
      updateFields.push('serial_number = ?');
      updateValues.push(serialNumber);
    }
    if (clientId !== undefined) {
      updateFields.push('client_id = ?');
      updateValues.push(clientId || null);
    }
    if (location !== undefined) {
      updateFields.push('location = ?');
      updateValues.push(location);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.params.id);
    await pool.query(`UPDATE equipment SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    res.json({ message: 'Equipment updated successfully' });
  } catch (error) {
    console.error('Update equipment error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Serial number already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete equipment (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), activityLogger('DELETE', 'equipment'), async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.query('UPDATE equipment SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Equipment deactivated successfully' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload document to equipment
router.post('/:id/documents', authenticateToken, requireRole('admin'), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' });
    }

    const { documentType, description } = req.body;
    const pool = await getConnection();

    // Verify equipment exists
    const [equipment] = await pool.query('SELECT id FROM equipment WHERE id = ?', [req.params.id]);
    if (equipment.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const [result] = await pool.query(
      `INSERT INTO work_order_documents 
       (equipment_id, document_type, file_path, file_name, file_size, mime_type, description, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        documentType || 'manual',
        `/uploads/documents/${req.file.filename}`,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        description || null,
        req.user.id
      ]
    );

    res.status(201).json({ 
      id: result.insertId, 
      filePath: `/uploads/documents/${req.file.filename}`,
      message: 'Document uploaded successfully' 
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get equipment documents
router.get('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [documents] = await pool.query(
      'SELECT * FROM work_order_documents WHERE equipment_id = ? ORDER BY created_at',
      [req.params.id]
    );
    res.json(documents);
  } catch (error) {
    console.error('Get equipment documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== HOUSINGS ROUTES ==========

// Get all housings
router.get('/housings', authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.query;
    const pool = await getConnection();
    
    let query = `
      SELECT eh.*, em.model_name, eb.name as brand_name
      FROM equipment_housings eh
      JOIN equipment_models em ON eh.model_id = em.id
      JOIN equipment_brands eb ON em.brand_id = eb.id
      WHERE eh.is_active = TRUE
    `;
    let params = [];

    if (modelId) {
      query += ' AND eh.model_id = ?';
      params.push(modelId);
    }

    query += ' ORDER BY eb.name, em.model_name, eh.housing_name';
    const [housings] = await pool.query(query, params);
    res.json(housings);
  } catch (error) {
    console.error('Get housings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create housing
router.post('/housings', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'equipment_housing'), async (req, res) => {
  try {
    const { modelId, housingName, description } = req.body;
    if (!modelId || !housingName) {
      return res.status(400).json({ error: 'Model ID and housing name are required' });
    }

    const pool = await getConnection();
    
    // Verify model exists
    const [model] = await pool.query('SELECT id FROM equipment_models WHERE id = ? AND is_active = TRUE', [modelId]);
    if (model.length === 0) {
      return res.status(400).json({ error: 'Invalid model ID' });
    }

    const [result] = await pool.query(
      'INSERT INTO equipment_housings (model_id, housing_name, description) VALUES (?, ?, ?)',
      [modelId, housingName, description || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Housing created successfully' });
  } catch (error) {
    console.error('Create housing error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'This model and housing combination already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update housing
router.put('/housings/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'equipment_housing'), async (req, res) => {
  try {
    const { modelId, housingName, description, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (modelId !== undefined) {
      const [model] = await pool.query('SELECT id FROM equipment_models WHERE id = ? AND is_active = TRUE', [modelId]);
      if (model.length === 0) {
        return res.status(400).json({ error: 'Invalid model ID' });
      }
      updateFields.push('model_id = ?');
      updateValues.push(modelId);
    }
    if (housingName !== undefined) {
      updateFields.push('housing_name = ?');
      updateValues.push(housingName);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.params.id);
    await pool.query(`UPDATE equipment_housings SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    res.json({ message: 'Housing updated successfully' });
  } catch (error) {
    console.error('Update housing error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'This model and housing combination already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== EQUIPMENT DOCUMENTS ROUTES ==========

// Get equipment documents (by brand, model, or housing)
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const { brandId, modelId, housingId } = req.query;
    const pool = await getConnection();
    
    let query = `
      SELECT ed.*, 
        eb.name as brand_name, 
        em.model_name, 
        eh.housing_name,
        u.full_name as uploaded_by_name
      FROM equipment_documents ed
      LEFT JOIN equipment_brands eb ON ed.brand_id = eb.id
      LEFT JOIN equipment_models em ON ed.model_id = em.id
      LEFT JOIN equipment_housings eh ON ed.housing_id = eh.id
      LEFT JOIN users u ON ed.uploaded_by = u.id
      WHERE 1=1
    `;
    let params = [];

    if (brandId) {
      query += ' AND ed.brand_id = ?';
      params.push(brandId);
    }
    if (modelId) {
      query += ' AND ed.model_id = ?';
      params.push(modelId);
    }
    if (housingId) {
      query += ' AND ed.housing_id = ?';
      params.push(housingId);
    }

    query += ' ORDER BY ed.created_at DESC';
    const [documents] = await pool.query(query, params);
    res.json(documents);
  } catch (error) {
    console.error('Get equipment documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload equipment document (brand, model, or housing)
router.post('/documents', authenticateToken, requireRole('admin'), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' });
    }

    const { brandId, modelId, housingId, documentType, description } = req.body;
    const pool = await getConnection();

    // At least one ID must be provided
    if (!brandId && !modelId && !housingId) {
      return res.status(400).json({ error: 'At least one of brandId, modelId, or housingId is required' });
    }

    // Verify IDs exist if provided
    if (brandId) {
      const [brand] = await pool.query('SELECT id FROM equipment_brands WHERE id = ?', [brandId]);
      if (brand.length === 0) {
        return res.status(404).json({ error: 'Brand not found' });
      }
    }
    if (modelId) {
      const [model] = await pool.query('SELECT id FROM equipment_models WHERE id = ?', [modelId]);
      if (model.length === 0) {
        return res.status(404).json({ error: 'Model not found' });
      }
    }
    if (housingId) {
      const [housing] = await pool.query('SELECT id FROM equipment_housings WHERE id = ?', [housingId]);
      if (housing.length === 0) {
        return res.status(404).json({ error: 'Housing not found' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO equipment_documents 
       (brand_id, model_id, housing_id, document_type, file_path, file_name, file_size, mime_type, description, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        brandId || null,
        modelId || null,
        housingId || null,
        documentType || 'manual',
        `/uploads/documents/${req.file.filename}`,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        description || null,
        req.user.id
      ]
    );

    res.status(201).json({ 
      id: result.insertId, 
      filePath: `/uploads/documents/${req.file.filename}`,
      message: 'Document uploaded successfully' 
    });
  } catch (error) {
    console.error('Upload equipment document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete equipment document
router.delete('/documents/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.query('DELETE FROM equipment_documents WHERE id = ?', [req.params.id]);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete equipment document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
