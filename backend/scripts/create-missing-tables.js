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
  database: process.env.DB_NAME || 'cigsa_db',
  multipleStatements: true
};

async function createMissingTables() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔧 Creando tablas faltantes...\n');

    // Crear tabla equipment_housings
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS equipment_housings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          model_id INT NOT NULL,
          housing_name VARCHAR(100) NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (model_id) REFERENCES equipment_models(id) ON DELETE CASCADE,
          UNIQUE KEY unique_model_housing (model_id, housing_name)
        )
      `);
      console.log('✅ Tabla equipment_housings creada/verificada');
    } catch (error) {
      console.error('❌ Error creando equipment_housings:', error.message);
    }

    // Agregar columna housing_id a equipment
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'equipment' 
        AND COLUMN_NAME = 'housing_id'
      `, [process.env.DB_NAME || 'cigsa_db']);
      
      if (columns.length === 0) {
        await connection.query('ALTER TABLE equipment ADD COLUMN housing_id INT NULL AFTER model_id');
        console.log('✅ Columna housing_id agregada a equipment');
      } else {
        console.log('ℹ️  Columna housing_id ya existe en equipment');
      }
    } catch (error) {
      console.error('❌ Error agregando housing_id:', error.message);
    }

    // Agregar foreign key para housing_id
    try {
      const [keys] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'equipment' 
        AND CONSTRAINT_NAME = 'equipment_ibfk_housing'
      `, [process.env.DB_NAME || 'cigsa_db']);
      
      if (keys.length === 0) {
        await connection.query(`
          ALTER TABLE equipment 
          ADD CONSTRAINT equipment_ibfk_housing 
          FOREIGN KEY (housing_id) REFERENCES equipment_housings(id) ON DELETE SET NULL
        `);
        console.log('✅ Foreign key equipment_ibfk_housing agregada');
      } else {
        console.log('ℹ️  Foreign key equipment_ibfk_housing ya existe');
      }
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('❌ Error agregando foreign key housing:', error.message);
      }
    }

    // Crear tabla equipment_documents
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS equipment_documents (
          id INT PRIMARY KEY AUTO_INCREMENT,
          brand_id INT,
          model_id INT,
          housing_id INT,
          document_type ENUM('blueprint', 'manual', 'specification', 'other') DEFAULT 'other',
          file_path VARCHAR(255) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_size INT,
          mime_type VARCHAR(50),
          description TEXT,
          uploaded_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (brand_id) REFERENCES equipment_brands(id) ON DELETE CASCADE,
          FOREIGN KEY (model_id) REFERENCES equipment_models(id) ON DELETE CASCADE,
          FOREIGN KEY (housing_id) REFERENCES equipment_housings(id) ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✅ Tabla equipment_documents creada/verificada');
    } catch (error) {
      console.error('❌ Error creando equipment_documents:', error.message);
    }

    // Agregar columna equipment_document_id a work_order_documents
    try {
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'work_order_documents' 
        AND COLUMN_NAME = 'equipment_document_id'
      `, [process.env.DB_NAME || 'cigsa_db']);
      
      if (columns.length === 0) {
        await connection.query(`
          ALTER TABLE work_order_documents 
          ADD COLUMN equipment_document_id INT NULL AFTER equipment_id
        `);
        console.log('✅ Columna equipment_document_id agregada a work_order_documents');
      } else {
        console.log('ℹ️  Columna equipment_document_id ya existe en work_order_documents');
      }
    } catch (error) {
      console.error('❌ Error agregando equipment_document_id:', error.message);
    }

    // Agregar foreign key para equipment_document_id
    try {
      const [keys] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'work_order_documents' 
        AND CONSTRAINT_NAME = 'work_order_documents_ibfk_equipment_doc'
      `, [process.env.DB_NAME || 'cigsa_db']);
      
      if (keys.length === 0) {
        await connection.query(`
          ALTER TABLE work_order_documents 
          ADD CONSTRAINT work_order_documents_ibfk_equipment_doc 
          FOREIGN KEY (equipment_document_id) REFERENCES equipment_documents(id) ON DELETE SET NULL
        `);
        console.log('✅ Foreign key work_order_documents_ibfk_equipment_doc agregada');
      } else {
        console.log('ℹ️  Foreign key work_order_documents_ibfk_equipment_doc ya existe');
      }
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('❌ Error agregando foreign key equipment_doc:', error.message);
      }
    }

    // Crear tabla work_order_document_permissions
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS work_order_document_permissions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          work_order_id INT NOT NULL,
          document_id INT NOT NULL,
          is_visible_to_technician BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
          FOREIGN KEY (document_id) REFERENCES work_order_documents(id) ON DELETE CASCADE,
          UNIQUE KEY unique_work_order_document (work_order_id, document_id)
        )
      `);
      console.log('✅ Tabla work_order_document_permissions creada/verificada');
    } catch (error) {
      console.error('❌ Error creando work_order_document_permissions:', error.message);
    }

    console.log('\n✨ ¡Proceso completado! Todas las tablas están listas.');

  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

createMissingTables();

