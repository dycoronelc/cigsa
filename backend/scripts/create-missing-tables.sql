-- Script para crear las tablas faltantes: equipment_housings, equipment_documents, work_order_document_permissions
-- y agregar la columna housing_id a equipment y equipment_document_id a work_order_documents

USE cigsa_db;

-- Crear tabla equipment_housings si no existe
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
);

-- Agregar columna housing_id a equipment si no existe
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'cigsa_db' 
  AND TABLE_NAME = 'equipment' 
  AND COLUMN_NAME = 'housing_id');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE equipment ADD COLUMN housing_id INT NULL AFTER model_id',
  'SELECT "Column housing_id already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar foreign key para housing_id si no existe
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = 'cigsa_db' 
  AND TABLE_NAME = 'equipment' 
  AND CONSTRAINT_NAME = 'equipment_ibfk_housing');

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE equipment ADD CONSTRAINT equipment_ibfk_housing FOREIGN KEY (housing_id) REFERENCES equipment_housings(id) ON DELETE SET NULL',
  'SELECT "Foreign key equipment_ibfk_housing already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Crear tabla equipment_documents si no existe
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
);

-- Agregar columna equipment_document_id a work_order_documents si no existe
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'cigsa_db' 
  AND TABLE_NAME = 'work_order_documents' 
  AND COLUMN_NAME = 'equipment_document_id');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE work_order_documents ADD COLUMN equipment_document_id INT NULL AFTER equipment_id',
  'SELECT "Column equipment_document_id already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar foreign key para equipment_document_id si no existe
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = 'cigsa_db' 
  AND TABLE_NAME = 'work_order_documents' 
  AND CONSTRAINT_NAME = 'work_order_documents_ibfk_equipment_doc');

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE work_order_documents ADD CONSTRAINT work_order_documents_ibfk_equipment_doc FOREIGN KEY (equipment_document_id) REFERENCES equipment_documents(id) ON DELETE SET NULL',
  'SELECT "Foreign key work_order_documents_ibfk_equipment_doc already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Crear tabla work_order_document_permissions si no existe
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
);

SELECT 'All tables and columns created successfully!' AS result;

