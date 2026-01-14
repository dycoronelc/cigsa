import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

let pool;

export const getConnection = async () => {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
      database: process.env.DB_NAME || 'cigsa_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
};

export const initDatabase = async () => {
  try {
    // Create database if it doesn't exist
    const connection = await mysql.createConnection(dbConfig);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'cigsa_db'}`);
    await connection.end();

    // Get connection to the database
    pool = await getConnection();

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute them one by one
    // This allows us to handle errors gracefully for statements that might already exist
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SET @'));
    
    for (const statement of statements) {
      try {
        if (statement.length > 0) {
          await pool.query(statement);
        }
      } catch (error) {
        // Ignore errors for duplicate keys/indexes/tables/columns
        const errorCode = error.code || '';
        const errorMessage = error.sqlMessage || error.message || '';
        
        if (errorCode === 'ER_DUP_KEYNAME' || 
            errorCode === 'ER_DUP_ENTRY' || 
            errorCode === 'ER_TABLE_EXISTS_ERROR' ||
            errorCode === 'ER_DUP_FIELDNAME' ||
            errorMessage.includes('Duplicate key name') ||
            errorMessage.includes('already exists') ||
            errorMessage.includes('Duplicate column name')) {
          // Silently skip - these are expected for existing databases
          continue;
        }
        // Log and re-throw other errors
        console.error('Schema execution error:', errorCode, errorMessage);
        throw error;
      }
    }
    
    // Add service_id column to work_orders if it doesn't exist
    try {
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'work_orders' 
        AND COLUMN_NAME = 'service_id'
      `, [process.env.DB_NAME || 'cigsa_db']);
      
      if (columns.length === 0) {
        await pool.query('ALTER TABLE work_orders ADD COLUMN service_id INT NULL AFTER equipment_id');
        await pool.query('ALTER TABLE work_orders ADD CONSTRAINT work_orders_ibfk_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL');
        await pool.query('CREATE INDEX idx_work_orders_service ON work_orders(service_id)');
        console.log('Added service_id column to work_orders table');
      }
    } catch (error) {
      // Ignore if column already exists or index already exists
      if (!error.sqlMessage?.includes('Duplicate') && !error.sqlMessage?.includes('already exists')) {
        console.error('Error adding service_id column:', error.message);
      }
    }

    // Add financial fields to services table if they don't exist
    try {
      const [costPriceCol] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'services' 
        AND COLUMN_NAME = 'cost_price'
      `, [process.env.DB_NAME || 'cigsa_db']);
      
      if (costPriceCol.length === 0) {
        await pool.query('ALTER TABLE services ADD COLUMN cost_price DECIMAL(10, 2) COMMENT "Costo total del servicio"');
        await pool.query('ALTER TABLE services ADD COLUMN labor_cost DECIMAL(10, 2) COMMENT "Costo de mano de obra"');
        await pool.query('ALTER TABLE services ADD COLUMN material_cost DECIMAL(10, 2) COMMENT "Costo de materiales"');
        console.log('Added financial fields to services table');
      }
    } catch (error) {
      // Ignore if columns already exist
      if (!error.sqlMessage?.includes('Duplicate') && !error.sqlMessage?.includes('already exists')) {
        console.error('Error adding financial fields to services:', error.message);
      }
    }

    // Add housing_id column to equipment table if it doesn't exist
    try {
      const [housingCol] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'equipment' 
        AND COLUMN_NAME = 'housing_id'
      `, [process.env.DB_NAME || 'cigsa_db']);
      
      if (housingCol.length === 0) {
        await pool.query('ALTER TABLE equipment ADD COLUMN housing_id INT NULL AFTER model_id');
        await pool.query('ALTER TABLE equipment ADD CONSTRAINT equipment_ibfk_housing FOREIGN KEY (housing_id) REFERENCES equipment_housings(id) ON DELETE SET NULL');
        console.log('Added housing_id column to equipment table');
      }
    } catch (error) {
      if (!error.sqlMessage?.includes('Duplicate') && !error.sqlMessage?.includes('already exists')) {
        console.error('Error adding housing_id column:', error.message);
      }
    }

    // Add equipment_document_id column to work_order_documents if it doesn't exist
    try {
      const [docCol] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'work_order_documents' 
        AND COLUMN_NAME = 'equipment_document_id'
      `, [process.env.DB_NAME || 'cigsa_db']);
      
      if (docCol.length === 0) {
        await pool.query('ALTER TABLE work_order_documents ADD COLUMN equipment_document_id INT NULL AFTER equipment_id');
        await pool.query('ALTER TABLE work_order_documents ADD CONSTRAINT work_order_documents_ibfk_equipment_doc FOREIGN KEY (equipment_document_id) REFERENCES equipment_documents(id) ON DELETE SET NULL');
        console.log('Added equipment_document_id column to work_order_documents table');
      }
    } catch (error) {
      if (!error.sqlMessage?.includes('Duplicate') && !error.sqlMessage?.includes('already exists')) {
        console.error('Error adding equipment_document_id column:', error.message);
      }
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.mkdirSync(path.join(uploadsDir, 'photos'), { recursive: true });
      fs.mkdirSync(path.join(uploadsDir, 'documents'), { recursive: true });
    }

    console.log('Database initialized successfully');
    return pool;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

