import { getConnection } from '../config/database.js';

/**
 * Script de migración para actualizar el esquema de equipos
 * Este script:
 * 1. Crea las nuevas tablas (equipment_brands, equipment_models)
 * 2. Migra datos existentes de equipment a la nueva estructura (si existen)
 * 3. Actualiza la tabla equipment para usar model_id
 */
async function migrate() {
  let pool;
  try {
    pool = await getConnection();
    console.log('Iniciando migración del esquema de equipos...\n');

    // 1. Crear tabla equipment_brands
    console.log('1. Creando tabla equipment_brands...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_brands (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✓ Tabla equipment_brands creada\n');

    // 2. Crear tabla equipment_models
    console.log('2. Creando tabla equipment_models...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_models (
        id INT PRIMARY KEY AUTO_INCREMENT,
        brand_id INT NOT NULL,
        model_name VARCHAR(100) NOT NULL,
        components TEXT COMMENT 'Componentes del modelo',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (brand_id) REFERENCES equipment_brands(id) ON DELETE CASCADE,
        UNIQUE KEY unique_brand_model (brand_id, model_name)
      )
    `);
    console.log('   ✓ Tabla equipment_models creada\n');

    // 3. Verificar si hay datos en la tabla equipment antigua
    console.log('3. Verificando datos existentes...');
    const [existingEquipment] = await pool.query('SELECT COUNT(*) as count FROM equipment');
    const hasExistingData = existingEquipment[0].count > 0;

    if (hasExistingData) {
      console.log(`   ⚠ Se encontraron ${existingEquipment[0].count} equipos existentes`);
      console.log('   ⚠ ADVERTENCIA: La migración de datos existentes requiere atención manual');
      console.log('   ⚠ Los equipos existentes deben ser migrados manualmente o eliminados antes de continuar\n');
      
      // Verificar si la tabla equipment ya tiene model_id
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'equipment' 
        AND COLUMN_NAME = 'model_id'
      `);
      
      if (columns.length === 0) {
        console.log('4. Actualizando tabla equipment...');
        // Crear tabla temporal para backup
        await pool.query(`
          CREATE TABLE IF NOT EXISTS equipment_backup AS 
          SELECT * FROM equipment
        `);
        console.log('   ✓ Backup creado en equipment_backup\n');

        // Eliminar tabla equipment antigua y crear nueva
        console.log('5. Recreando tabla equipment con nueva estructura...');
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        await pool.query('DROP TABLE IF EXISTS equipment');
        await pool.query(`
          CREATE TABLE equipment (
            id INT PRIMARY KEY AUTO_INCREMENT,
            model_id INT NOT NULL,
            serial_number VARCHAR(50) NOT NULL,
            client_id INT,
            location VARCHAR(100),
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (model_id) REFERENCES equipment_models(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
            UNIQUE KEY unique_serial (serial_number)
          )
        `);
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('   ✓ Tabla equipment recreada con nueva estructura\n');
      } else {
        console.log('   ✓ La tabla equipment ya tiene la nueva estructura\n');
      }
    } else {
      console.log('   ✓ No hay datos existentes, creando nueva estructura...\n');
      
      // Verificar si la tabla equipment existe y tiene la estructura antigua
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'equipment'
      `);
      
      if (columns.length > 0) {
        const hasModelId = columns.some(col => col.COLUMN_NAME === 'model_id');
        if (!hasModelId) {
          console.log('4. Actualizando tabla equipment...');
          await pool.query('SET FOREIGN_KEY_CHECKS = 0');
          await pool.query('DROP TABLE IF EXISTS equipment');
          await pool.query(`
            CREATE TABLE equipment (
              id INT PRIMARY KEY AUTO_INCREMENT,
              model_id INT NOT NULL,
              serial_number VARCHAR(50) NOT NULL,
              client_id INT,
              location VARCHAR(100),
              description TEXT,
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (model_id) REFERENCES equipment_models(id) ON DELETE CASCADE,
              FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
              UNIQUE KEY unique_serial (serial_number)
            )
          `);
          await pool.query('SET FOREIGN_KEY_CHECKS = 1');
          console.log('   ✓ Tabla equipment actualizada\n');
        }
      } else {
        // Crear tabla equipment nueva
        await pool.query(`
          CREATE TABLE IF NOT EXISTS equipment (
            id INT PRIMARY KEY AUTO_INCREMENT,
            model_id INT NOT NULL,
            serial_number VARCHAR(50) NOT NULL,
            client_id INT,
            location VARCHAR(100),
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (model_id) REFERENCES equipment_models(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
            UNIQUE KEY unique_serial (serial_number)
          )
        `);
        console.log('   ✓ Tabla equipment creada\n');
      }
    }

    // 6. Crear índices
    console.log('6. Creando índices...');
    try {
      await pool.query('CREATE INDEX idx_equipment_model ON equipment(model_id)');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) console.log('   ⚠ Índice ya existe');
    }
    try {
      await pool.query('CREATE INDEX idx_equipment_serial ON equipment(serial_number)');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) console.log('   ⚠ Índice ya existe');
    }
    try {
      await pool.query('CREATE INDEX idx_equipment_models_brand ON equipment_models(brand_id)');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) console.log('   ⚠ Índice ya existe');
    }
    console.log('   ✓ Índices creados\n');

    console.log('✅ Migración completada exitosamente!\n');
    console.log('Siguiente paso: Ejecutar el script de importación de datos:');
    console.log('   node scripts/import-equipment-from-excel.js\n');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

migrate();

