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
    
    // Separate CREATE TABLE statements from CREATE INDEX statements
    const createTableStatements = [];
    const createIndexStatements = [];
    
    for (const statement of statements) {
      if (statement.toUpperCase().startsWith('CREATE INDEX')) {
        createIndexStatements.push(statement);
      } else {
        createTableStatements.push(statement);
      }
    }
    
    // First, execute all CREATE TABLE statements
    for (const statement of createTableStatements) {
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
    
    // Then, execute all CREATE INDEX statements (after all tables exist)
    for (const statement of createIndexStatements) {
      try {
        if (statement.length > 0) {
          await pool.query(statement);
        }
      } catch (error) {
        // Ignore errors for duplicate indexes
        const errorCode = error.code || '';
        const errorMessage = error.sqlMessage || error.message || '';
        
        if (errorCode === 'ER_DUP_KEYNAME' || 
            errorMessage.includes('Duplicate key name') ||
            errorMessage.includes('already exists')) {
          // Silently skip - index already exists
          continue;
        }
        // Log other errors but don't fail (indexes are optional)
        console.warn('Index creation warning:', errorCode, errorMessage);
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

    // Add service_location column to work_orders if it doesn't exist
    try {
      const dbName = process.env.DB_NAME || 'cigsa_db';
      const [cols] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'work_orders'
        AND COLUMN_NAME = 'service_location'
      `, [dbName]);

      if (cols.length === 0) {
        await pool.query('ALTER TABLE work_orders ADD COLUMN service_location VARCHAR(100) NULL AFTER service_id');
        console.log('Added service_location column to work_orders table');
      }
    } catch (error) {
      if (!error.sqlMessage?.includes('Duplicate') && !error.sqlMessage?.includes('already exists')) {
        console.error('Error adding service_location column:', error.message);
      }
    }

    // Add service_housing_count column to work_orders if it doesn't exist
    try {
      const dbName = process.env.DB_NAME || 'cigsa_db';
      const [cols] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'work_orders'
        AND COLUMN_NAME = 'service_housing_count'
      `, [dbName]);

      if (cols.length === 0) {
        await pool.query('ALTER TABLE work_orders ADD COLUMN service_housing_count INT DEFAULT 0 AFTER service_location');
        console.log('Added service_housing_count column to work_orders table');
      }
    } catch (error) {
      if (!error.sqlMessage?.includes('Duplicate') && !error.sqlMessage?.includes('already exists')) {
        console.error('Error adding service_housing_count column:', error.message);
      }
    }

    // Add client_service_order_number column to work_orders if it doesn't exist
    try {
      const dbName = process.env.DB_NAME || 'cigsa_db';
      const [cols] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'work_orders'
        AND COLUMN_NAME = 'client_service_order_number'
      `, [dbName]);

      if (cols.length === 0) {
        await pool.query('ALTER TABLE work_orders ADD COLUMN client_service_order_number VARCHAR(50) NULL COMMENT \'N° Orden de Servicio del Cliente\' AFTER service_location');
        console.log('Added client_service_order_number column to work_orders table');
      }
    } catch (error) {
      if (!error.sqlMessage?.includes('Duplicate') && !error.sqlMessage?.includes('already exists')) {
        console.error('Error adding client_service_order_number column:', error.message);
      }
    }

    // Ensure work_order_services table exists (múltiples servicios por OT)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS work_order_services (
          id INT PRIMARY KEY AUTO_INCREMENT,
          work_order_id INT NOT NULL,
          service_id INT NOT NULL,
          housing_count INT DEFAULT 0 COMMENT 'Cantidad de alojamientos a intervenir para este servicio',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
          FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
          UNIQUE KEY unique_work_order_service (work_order_id, service_id)
        )
      `);
      // Migrate existing work_orders with service_id to work_order_services
      const [existing] = await pool.query(`
        SELECT id, service_id, service_housing_count 
        FROM work_orders 
        WHERE service_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM work_order_services wos WHERE wos.work_order_id = work_orders.id)
      `);
      for (const row of existing) {
        try {
          await pool.query(
            'INSERT INTO work_order_services (work_order_id, service_id, housing_count) VALUES (?, ?, ?)',
            [row.id, row.service_id, row.service_housing_count || 0]
          );
        } catch (err) {
          if (!err.sqlMessage?.includes('Duplicate')) console.warn('Migration work_order_services:', err.message);
        }
      }
      if (existing.length > 0) {
        console.log(`Migrated ${existing.length} work orders to work_order_services`);
      }
    } catch (error) {
      console.error('Error ensuring work_order_services table:', error.sqlMessage || error.message);
    }

    // Ensure work_order_housings table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS work_order_housings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          work_order_id INT NOT NULL,
          measure_code VARCHAR(10) NOT NULL,
          description TEXT,
          nominal_value DECIMAL(10, 3),
          nominal_unit VARCHAR(20),
          tolerance VARCHAR(50) COMMENT 'Tolerancia permitida (ej: +0.5, -0.3, ±0.2)',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
          UNIQUE KEY unique_work_order_measure_code (work_order_id, measure_code)
        )
      `);
    } catch (error) {
      console.error('Error ensuring work_order_housings table:', error.sqlMessage || error.message);
    }

    // Add tolerance column to work_order_housings if it doesn't exist
    try {
      const [toleranceCol] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'work_order_housings' 
        AND COLUMN_NAME = 'tolerance'
      `, [process.env.DB_NAME || 'cigsa_db']);
      
      if (toleranceCol.length === 0) {
        await pool.query('ALTER TABLE work_order_housings ADD COLUMN tolerance VARCHAR(50) COMMENT "Tolerancia permitida (ej: +0.5, -0.3, ±0.2)"');
        console.log('Added tolerance column to work_order_housings table');
      }
    } catch (error) {
      if (!error.sqlMessage?.includes('Duplicate') && !error.sqlMessage?.includes('already exists')) {
        console.error('Error adding tolerance column:', error.message);
      }
    }

    // Add work_order_service_id to work_order_housings (alojamientos por servicio)
    const dbName = process.env.DB_NAME || 'cigsa_db';
    try {
      const [wosCol] = await pool.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'work_order_housings' AND COLUMN_NAME = 'work_order_service_id'
      `, [dbName]);
      if (wosCol.length === 0) {
        await pool.query('ALTER TABLE work_order_housings ADD COLUMN work_order_service_id INT NULL AFTER work_order_id');
        try {
          await pool.query('ALTER TABLE work_order_housings ADD CONSTRAINT woh_fk_wos FOREIGN KEY (work_order_service_id) REFERENCES work_order_services(id) ON DELETE CASCADE');
        } catch (fkErr) {
          if (!fkErr.sqlMessage?.includes('Duplicate')) console.warn('FK work_order_service_id:', fkErr.message);
        }
        // Migrar housings legacy: asignar a work_order_services
        const [legacyWoIds] = await pool.query(`
          SELECT DISTINCT work_order_id FROM work_order_housings WHERE work_order_service_id IS NULL
        `);
        for (const { work_order_id } of legacyWoIds) {
          const [wosRows] = await pool.query(
            'SELECT id FROM work_order_services WHERE work_order_id = ? ORDER BY id LIMIT 1',
            [work_order_id]
          );
          let wosId = wosRows[0]?.id;
          if (!wosId) {
            const [wo] = await pool.query('SELECT service_id FROM work_orders WHERE id = ?', [work_order_id]);
            const svcId = wo[0]?.service_id;
            const [cnt] = await pool.query('SELECT COUNT(*) as c FROM work_order_housings WHERE work_order_id = ?', [work_order_id]);
            const hCount = cnt[0]?.c || 0;
            if (svcId) {
              const [ins] = await pool.query(
                'INSERT INTO work_order_services (work_order_id, service_id, housing_count) VALUES (?, ?, ?)',
                [work_order_id, svcId, hCount]
              );
              wosId = ins.insertId;
            } else {
              const [firstSvc] = await pool.query('SELECT id FROM services WHERE is_active = 1 LIMIT 1');
              if (firstSvc.length > 0) {
                const [ins] = await pool.query(
                  'INSERT INTO work_order_services (work_order_id, service_id, housing_count) VALUES (?, ?, ?)',
                  [work_order_id, firstSvc[0].id, hCount]
                );
                wosId = ins.insertId;
              }
            }
          }
          if (wosId) {
            await pool.query('UPDATE work_order_housings SET work_order_service_id = ? WHERE work_order_id = ? AND work_order_service_id IS NULL', [wosId, work_order_id]);
          }
        }
        try {
          await pool.query('ALTER TABLE work_order_housings DROP INDEX unique_work_order_measure_code');
        } catch (e) { /* puede no existir */ }
        try {
          await pool.query('ALTER TABLE work_order_housings ADD UNIQUE KEY unique_work_order_service_measure (work_order_service_id, measure_code)');
        } catch (e) {
          if (!e.sqlMessage?.includes('Duplicate')) console.warn('Unique work_order_service_measure:', e.message);
        }
        console.log('Added work_order_service_id to work_order_housings, migrated legacy data');
      }
    } catch (error) {
      if (!error.sqlMessage?.includes('Duplicate') && !error.sqlMessage?.includes('already exists')) {
        console.error('Error adding work_order_service_id:', error.message);
      }
    }

    // Extend work_orders.status enum to include cancelled and on_hold
    try {
      await pool.query(`
        ALTER TABLE work_orders MODIFY COLUMN status ENUM(
          'created', 'assigned', 'in_progress', 'completed', 'accepted', 'cancelled', 'on_hold'
        ) DEFAULT 'created'
      `);
      console.log('Extended work_orders.status enum (cancelled, on_hold)');
    } catch (error) {
      const msg = error.sqlMessage || error.message || '';
      if (!msg.includes('Duplicate') && !msg.includes('already exists') && !msg.includes('same as')) {
        console.warn('Status enum migration:', msg);
      }
    }

    // Firma de conformidad
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS work_order_conformity_signatures (
          id INT PRIMARY KEY AUTO_INCREMENT,
          work_order_id INT NOT NULL,
          signature_data TEXT NOT NULL,
          signed_by_name VARCHAR(200) NOT NULL,
          signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
        )
      `);
    } catch (error) {
      console.error('Error ensuring work_order_conformity_signatures:', error.sqlMessage || error.message);
    }

    // Ensure work_order_housing_measurements table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS work_order_housing_measurements (
          id INT PRIMARY KEY AUTO_INCREMENT,
          measurement_id INT NOT NULL,
          housing_id INT NOT NULL,
          x1 DECIMAL(10, 3),
          y1 DECIMAL(10, 3),
          unit VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE CASCADE,
          FOREIGN KEY (housing_id) REFERENCES work_order_housings(id) ON DELETE CASCADE,
          UNIQUE KEY unique_measurement_housing (measurement_id, housing_id)
        )
      `);
    } catch (error) {
      console.error('Error ensuring work_order_housing_measurements table:', error.sqlMessage || error.message);
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

    // Ensure service_categories table exists (for older databases / partial setups)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS service_categories (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error('Error ensuring service_categories table:', error.sqlMessage || error.message);
    }

    // Add category_id column + FK to services table if it doesn't exist
    try {
      const dbName = process.env.DB_NAME || 'cigsa_db';
      const [categoryIdCol] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'services'
        AND COLUMN_NAME = 'category_id'
      `, [dbName]);

      if (categoryIdCol.length === 0) {
        await pool.query('ALTER TABLE services ADD COLUMN category_id INT NULL AFTER category');
        console.log('Added category_id column to services table');
      }

      // Try to add FK if not present
      const [fk] = await pool.query(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'services'
        AND COLUMN_NAME = 'category_id'
        AND REFERENCED_TABLE_NAME = 'service_categories'
      `, [dbName]);

      if (fk.length === 0) {
        try {
          await pool.query('ALTER TABLE services ADD CONSTRAINT services_ibfk_category FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL');
        } catch (error) {
          const msg = error.sqlMessage || error.message || '';
          if (!msg.includes('Duplicate foreign key') && !msg.includes('already exists')) {
            console.warn('FK creation warning (services.category_id):', msg);
          }
        }
      }

      // Try to add index (safe to attempt)
      try {
        await pool.query('CREATE INDEX idx_services_category_id ON services(category_id)');
      } catch (error) {
        const msg = error.sqlMessage || error.message || '';
        if (!msg.includes('Duplicate key name') && !msg.includes('already exists')) {
          console.warn('Index creation warning (idx_services_category_id):', msg);
        }
      }
    } catch (error) {
      const msg = error.sqlMessage || error.message || '';
      if (!msg.includes('Duplicate') && !msg.includes('already exists')) {
        console.error('Error adding category_id to services:', msg);
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

