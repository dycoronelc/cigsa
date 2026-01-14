import XLSX from 'xlsx';
import { getConnection } from '../config/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Script para importar equipos desde el archivo Excel Equipos.xlsx
 * Este script:
 * 1. Lee el archivo Excel
 * 2. Extrae marcas, modelos, componentes y seriales
 * 3. Inserta los datos en las tablas equipment_brands, equipment_models y equipment
 */
async function importEquipment() {
  let pool;
  try {
    pool = await getConnection();
    console.log('=== IMPORTACIÓN DE EQUIPOS DESDE EXCEL ===\n');

    // Leer el archivo Excel
    const filePath = join(__dirname, '../data/Equipos.xlsx');
    console.log(`Leyendo archivo: ${filePath}...`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(`✓ Archivo leído: ${data.length} filas\n`);

    // Procesar la estructura del Excel
    const equipmentTypes = {};
    const columns = Object.keys(data[0]).filter(col => col !== 'MARCA');

    console.log('Procesando estructura del Excel...');
    columns.forEach(columnName => {
      // Extraer marca del nombre de columna
      let brand = columnName;
      if (columnName.includes('_')) {
        brand = columnName.split('_')[0];
      }
      
      // Buscar modelo
      const modelRow = data.find(row => row.MARCA === 'MODELO');
      const model = modelRow ? modelRow[columnName] : null;
      
      // Buscar componentes
      const componentsRow = data.find(row => row.MARCA === 'EJM COMPONENTES');
      const components = componentsRow ? componentsRow[columnName] : null;
      
      // Buscar todos los seriales
      const serials = [];
      data.forEach(row => {
        if (row[columnName] && 
            row[columnName] !== model && 
            row[columnName] !== components &&
            row.MARCA !== 'MODELO' &&
            row.MARCA !== 'EJM COMPONENTES' &&
            row.MARCA !== 'ID') {
          serials.push(row[columnName]);
        }
      });
      
      // También incluir seriales de la fila ID
      const idRow = data.find(row => row.MARCA === 'ID');
      if (idRow && idRow[columnName]) {
        serials.push(idRow[columnName]);
      }
      
      // Agregar seriales de filas sin MARCA
      data.forEach(row => {
        if (!row.MARCA && row[columnName] && 
            row[columnName] !== model && 
            row[columnName] !== components) {
          if (!serials.includes(row[columnName])) {
            serials.push(row[columnName]);
          }
        }
      });
      
      // Crear clave única para el tipo de equipo
      const equipmentKey = `${brand}_${model || 'UNKNOWN'}`;
      
      if (!equipmentTypes[equipmentKey]) {
        equipmentTypes[equipmentKey] = {
          brand: brand,
          model: model,
          components: components,
          serials: []
        };
      }
      
      // Agregar seriales únicos
      serials.forEach(serial => {
        if (serial && !equipmentTypes[equipmentKey].serials.includes(serial)) {
          equipmentTypes[equipmentKey].serials.push(serial);
        }
      });
    });
    console.log(`✓ ${Object.keys(equipmentTypes).length} tipos de equipos identificados\n`);

    // Iniciar transacción
    await pool.query('START TRANSACTION');

    try {
      // 1. Insertar marcas
      console.log('1. Insertando marcas...');
      const brandsMap = new Map();
      const uniqueBrands = [...new Set(Object.values(equipmentTypes).map(eq => eq.brand))];
      
      for (const brandName of uniqueBrands) {
        // Verificar si ya existe
        const [existing] = await pool.query(
          'SELECT id FROM equipment_brands WHERE name = ?',
          [brandName]
        );
        
        if (existing.length > 0) {
          brandsMap.set(brandName, existing[0].id);
          console.log(`   - ${brandName} (ya existe: ID ${existing[0].id})`);
        } else {
          const [result] = await pool.query(
            'INSERT INTO equipment_brands (name) VALUES (?)',
            [brandName]
          );
          brandsMap.set(brandName, result.insertId);
          console.log(`   ✓ ${brandName} (ID: ${result.insertId})`);
        }
      }
      console.log('');

      // 2. Insertar modelos
      console.log('2. Insertando modelos...');
      const modelsMap = new Map();
      
      for (const [key, equipment] of Object.entries(equipmentTypes)) {
        const brandId = brandsMap.get(equipment.brand);
        
        // Verificar si ya existe
        const [existing] = await pool.query(
          'SELECT id FROM equipment_models WHERE brand_id = ? AND model_name = ?',
          [brandId, equipment.model || 'UNKNOWN']
        );
        
        if (existing.length > 0) {
          modelsMap.set(key, existing[0].id);
          console.log(`   - ${equipment.brand} ${equipment.model || 'UNKNOWN'} (ya existe: ID ${existing[0].id})`);
        } else {
          const [result] = await pool.query(
            'INSERT INTO equipment_models (brand_id, model_name, components) VALUES (?, ?, ?)',
            [brandId, equipment.model || 'UNKNOWN', equipment.components || null]
          );
          modelsMap.set(key, result.insertId);
          console.log(`   ✓ ${equipment.brand} ${equipment.model || 'UNKNOWN'} (ID: ${result.insertId})`);
        }
      }
      console.log('');

      // 3. Insertar equipos (seriales)
      console.log('3. Insertando equipos individuales...');
      let inserted = 0;
      let skipped = 0;
      
      for (const [key, equipment] of Object.entries(equipmentTypes)) {
        const modelId = modelsMap.get(key);
        
        for (const serial of equipment.serials) {
          if (!serial || serial.trim() === '') continue;
          
          try {
            // Verificar si ya existe
            const [existing] = await pool.query(
              'SELECT id FROM equipment WHERE serial_number = ?',
              [serial.trim()]
            );
            
            if (existing.length > 0) {
              skipped++;
              continue;
            }
            
            await pool.query(
              'INSERT INTO equipment (model_id, serial_number) VALUES (?, ?)',
              [modelId, serial.trim()]
            );
            inserted++;
          } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
              skipped++;
            } else {
              console.error(`   ⚠ Error insertando serial ${serial}:`, error.message);
            }
          }
        }
      }
      
      console.log(`   ✓ ${inserted} equipos insertados`);
      if (skipped > 0) {
        console.log(`   - ${skipped} equipos omitidos (ya existen)`);
      }
      console.log('');

      // Confirmar transacción
      await pool.query('COMMIT');
      console.log('✅ Importación completada exitosamente!\n');

      // Resumen final
      const [brandsCount] = await pool.query('SELECT COUNT(*) as count FROM equipment_brands');
      const [modelsCount] = await pool.query('SELECT COUNT(*) as count FROM equipment_models');
      const [equipmentCount] = await pool.query('SELECT COUNT(*) as count FROM equipment');
      
      console.log('=== RESUMEN ===');
      console.log(`Marcas: ${brandsCount[0].count}`);
      console.log(`Modelos: ${modelsCount[0].count}`);
      console.log(`Equipos: ${equipmentCount[0].count}`);

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Error durante la importación:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

importEquipment();

