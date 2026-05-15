-- Migración: nivel Componentes entre servicio y alojamiento en OT
-- Ejecutar sobre la base cigsa_db (ajuste USE si aplica).
-- Recomendado: respaldar la BD antes de ejecutar.

USE cigsa_db;

-- 1) Maestro de componentes
CREATE TABLE IF NOT EXISTS components (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO components (name, description, is_system, is_active)
SELECT 'Componente General', 'Componente por defecto para servicios existentes y generales', TRUE, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM components WHERE name = 'Componente General');

-- 2) Componentes por línea de servicio en la OT
CREATE TABLE IF NOT EXISTS work_order_service_components (
  id INT PRIMARY KEY AUTO_INCREMENT,
  work_order_service_id INT NOT NULL,
  component_id INT NOT NULL,
  housing_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_service_id) REFERENCES work_order_services(id) ON DELETE CASCADE,
  FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE RESTRICT,
  UNIQUE KEY unique_wos_component (work_order_service_id, component_id)
);

-- 3) Columna en alojamientos (si no existe)
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'work_order_housings'
    AND COLUMN_NAME = 'work_order_service_component_id'
);

SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE work_order_housings ADD COLUMN work_order_service_component_id INT NULL AFTER work_order_service_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql_add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) Crear Componente General para cada servicio de OT que aún no lo tenga
INSERT INTO work_order_service_components (work_order_service_id, component_id, housing_count)
SELECT wos.id, c.id, COALESCE(wos.housing_count, 0)
FROM work_order_services wos
CROSS JOIN components c
WHERE c.name = 'Componente General'
  AND NOT EXISTS (
    SELECT 1 FROM work_order_service_components wosc
    WHERE wosc.work_order_service_id = wos.id
  );

-- 5) Enlazar alojamientos existentes al componente general del servicio
UPDATE work_order_housings wh
INNER JOIN work_order_services wos ON wh.work_order_service_id = wos.id
INNER JOIN work_order_service_components wosc
  ON wosc.work_order_service_id = wos.id
INNER JOIN components c ON c.id = wosc.component_id AND c.name = 'Componente General'
SET wh.work_order_service_component_id = wosc.id
WHERE wh.work_order_service_component_id IS NULL
  AND wh.work_order_service_id IS NOT NULL;

-- 6) Índice único por componente + medida (opcional; omitir si ya existe)
-- ALTER TABLE work_order_housings DROP INDEX unique_work_order_service_measure;
-- ALTER TABLE work_order_housings ADD UNIQUE KEY unique_wosc_measure (work_order_service_component_id, measure_code);

SELECT 'Migración componentes completada' AS status;
SELECT COUNT(*) AS total_componentes FROM components;
SELECT COUNT(*) AS lineas_wosc FROM work_order_service_components;
SELECT COUNT(*) AS alojamientos_vinculados FROM work_order_housings WHERE work_order_service_component_id IS NOT NULL;
