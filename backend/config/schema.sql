-- CIGSA Database Schema

-- Users table (includes both admins and technicians)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'technician') NOT NULL DEFAULT 'technician',
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  company_name VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  contact_person VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Service Categories table (Maestro de categorías para servicios)
CREATE TABLE IF NOT EXISTS service_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Services table (servicios del taller)
CREATE TABLE IF NOT EXISTS services (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  category_id INT,
  estimated_duration INT COMMENT 'Duración estimada en horas',
  standard_price DECIMAL(10, 2),
  cost_price DECIMAL(10, 2) COMMENT 'Costo total del servicio',
  labor_cost DECIMAL(10, 2) COMMENT 'Costo de mano de obra',
  material_cost DECIMAL(10, 2) COMMENT 'Costo de materiales',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL
);


-- Equipment Brands table (Marcas de equipos)
CREATE TABLE IF NOT EXISTS equipment_brands (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Equipment Models table (Modelos de equipos)
CREATE TABLE IF NOT EXISTS equipment_models (
  id INT PRIMARY KEY AUTO_INCREMENT,
  brand_id INT NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  components TEXT COMMENT 'Componentes del modelo (ej: Hoja, Articulación Central)',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES equipment_brands(id) ON DELETE CASCADE,
  UNIQUE KEY unique_brand_model (brand_id, model_name)
);

-- Equipment Housings table (Alojamientos)
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

-- Equipment table (Equipos individuales)
CREATE TABLE IF NOT EXISTS equipment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  model_id INT NOT NULL,
  housing_id INT,
  serial_number VARCHAR(50) NOT NULL,
  client_id INT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES equipment_models(id) ON DELETE CASCADE,
  FOREIGN KEY (housing_id) REFERENCES equipment_housings(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  UNIQUE KEY unique_serial (serial_number)
);

-- Work Orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  client_id INT NOT NULL,
  equipment_id INT NOT NULL,
  service_id INT,
  service_location VARCHAR(100),
  client_service_order_number VARCHAR(50) COMMENT 'N° Orden de Servicio del Cliente',
  service_housing_count INT DEFAULT 0,
  assigned_technician_id INT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('created', 'assigned', 'in_progress', 'completed', 'accepted') DEFAULT 'created',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  scheduled_date DATE,
  start_date DATETIME,
  completion_date DATETIME,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_technician_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Migration-safe: add column if table already exists (duplicate column errors are ignored by initDatabase)
ALTER TABLE work_orders ADD COLUMN client_service_order_number VARCHAR(50) NULL COMMENT 'N° Orden de Servicio del Cliente';

-- Work Order Service Housings (Alojamientos intervenidos en la OT)
CREATE TABLE IF NOT EXISTS work_order_housings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  work_order_id INT NOT NULL,
  measure_code VARCHAR(10) NOT NULL COMMENT 'Correlativo tipo A, B, C... por OT',
  description TEXT,
  nominal_value DECIMAL(10, 3),
  nominal_unit VARCHAR(20),
  tolerance VARCHAR(50) COMMENT 'Tolerancia permitida (ej: +0.5, -0.3, ±0.2)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  UNIQUE KEY unique_work_order_measure_code (work_order_id, measure_code)
);

-- Measurements per housing (X1/Y1 + unidad) linked to a measurement event (initial/final)
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
);

-- Measurements table (initial and final measurements)
CREATE TABLE IF NOT EXISTS measurements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  work_order_id INT NOT NULL,
  measurement_type ENUM('initial', 'final') NOT NULL,
  measurement_date DATETIME NOT NULL,
  temperature DECIMAL(10, 2),
  pressure DECIMAL(10, 2),
  voltage DECIMAL(10, 2),
  current DECIMAL(10, 2),
  resistance DECIMAL(10, 2),
  other_measurements JSON,
  notes TEXT,
  taken_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (taken_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Work Order Photos table
CREATE TABLE IF NOT EXISTS work_order_photos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  work_order_id INT NOT NULL,
  photo_path VARCHAR(255) NOT NULL,
  photo_type ENUM('inspection', 'during_service', 'completion') DEFAULT 'during_service',
  description TEXT,
  uploaded_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Equipment Documents table (Documentos para Marca, Modelo y Alojamiento)
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

-- Work Order Documents table (PDFs, images for equipment)
CREATE TABLE IF NOT EXISTS work_order_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  work_order_id INT,
  equipment_id INT,
  equipment_document_id INT COMMENT 'Referencia al documento de equipo si aplica',
  document_type ENUM('blueprint', 'manual', 'specification', 'other') DEFAULT 'other',
  file_path VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT,
  mime_type VARCHAR(50),
  description TEXT,
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  FOREIGN KEY (equipment_document_id) REFERENCES equipment_documents(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Work Order Document Permissions table (Control de qué documentos puede ver el técnico)
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

-- Work Order Observations table
CREATE TABLE IF NOT EXISTS work_order_observations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  work_order_id INT NOT NULL,
  observation TEXT NOT NULL,
  observation_type ENUM('general', 'issue', 'solution', 'recommendation') DEFAULT 'general',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity Log table (Bitácora)
CREATE TABLE IF NOT EXISTS activity_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  description TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for better performance
-- Note: These will be created only if they don't exist (errors are handled in database.js)
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_technician ON work_orders(assigned_technician_id);
CREATE INDEX idx_work_orders_client ON work_orders(client_id);
CREATE INDEX idx_work_orders_equipment ON work_orders(equipment_id);
CREATE INDEX idx_work_orders_service ON work_orders(service_id);
CREATE INDEX idx_work_orders_service_housing_count ON work_orders(service_housing_count);
CREATE INDEX idx_equipment_client ON equipment(client_id);
CREATE INDEX idx_equipment_model ON equipment(model_id);
CREATE INDEX idx_equipment_serial ON equipment(serial_number);
CREATE INDEX idx_equipment_models_brand ON equipment_models(brand_id);
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);

