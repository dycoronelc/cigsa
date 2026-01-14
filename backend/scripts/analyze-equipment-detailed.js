import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Leer el archivo Excel
const filePath = join(__dirname, '../data/Equipos.xlsx');
const workbook = XLSX.readFile(filePath);

const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('=== ANÁLISIS DETALLADO DEL ARCHIVO EQUIPOS.XLSX ===\n');

// Procesar la estructura
const equipmentTypes = {};

// Obtener todas las columnas (excluyendo MARCA)
const columns = Object.keys(data[0]).filter(col => col !== 'MARCA');

// Procesar cada columna (tipo de equipo)
columns.forEach(columnName => {
  // Extraer marca del nombre de columna
  let brand = columnName;
  if (columnName.includes('_')) {
    // Si tiene sufijo numérico, extraer la marca base
    brand = columnName.split('_')[0];
  }
  
  // Buscar modelo (fila donde MARCA = "MODELO")
  const modelRow = data.find(row => row.MARCA === 'MODELO');
  const model = modelRow ? modelRow[columnName] : null;
  
  // Buscar componentes (fila donde MARCA = "EJM COMPONENTES")
  const componentsRow = data.find(row => row.MARCA === 'EJM COMPONENTES');
  const components = componentsRow ? componentsRow[columnName] : null;
  
  // Buscar todos los IDs/seriales (filas donde MARCA = "ID" o está vacío y hay valor en la columna)
  const serials = [];
  data.forEach(row => {
    if (row[columnName] && row[columnName] !== model && row[columnName] !== components) {
      serials.push(row[columnName]);
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
  
  // Agregar seriales
  equipmentTypes[equipmentKey].serials.push(...serials);
});

// Mostrar resultados
console.log(`Total de tipos de equipos únicos: ${Object.keys(equipmentTypes).length}\n`);

Object.entries(equipmentTypes).forEach(([key, equipment]) => {
  console.log(`\n--- ${key} ---`);
  console.log(`Marca: ${equipment.brand}`);
  console.log(`Modelo: ${equipment.model || 'N/A'}`);
  console.log(`Componentes: ${equipment.components || 'N/A'}`);
  console.log(`Cantidad de seriales: ${equipment.serials.length}`);
  console.log(`Primeros 5 seriales: ${equipment.serials.slice(0, 5).join(', ')}`);
  if (equipment.serials.length > 5) {
    console.log(`... y ${equipment.serials.length - 5} más`);
  }
});

// Resumen estadístico
console.log('\n\n=== RESUMEN ESTADÍSTICO ===');
const totalSerials = Object.values(equipmentTypes).reduce((sum, eq) => sum + eq.serials.length, 0);
console.log(`Total de equipos (seriales): ${totalSerials}`);

const brands = [...new Set(Object.values(equipmentTypes).map(eq => eq.brand))];
console.log(`Marcas únicas: ${brands.length} - ${brands.join(', ')}`);

console.log('\n\n=== ESTRUCTURA PROPUESTA PARA BASE DE DATOS ===');
console.log(`
Se recomienda crear las siguientes tablas:

1. equipment_brands (Marcas)
   - id
   - name (ej: CATERPILLAR, KOMATSU, LIEBHERR, etc.)

2. equipment_models (Modelos)
   - id
   - brand_id (FK a equipment_brands)
   - model_name (ej: Trucks_777G, Loader_834K, etc.)
   - components (texto con los componentes)

3. equipment (Equipos individuales)
   - id
   - model_id (FK a equipment_models)
   - serial_number (el ID/serial del equipo)
   - client_id (FK a clients - puede ser NULL inicialmente)
   - location
   - description
   - is_active
   - created_at
   - updated_at

Esta estructura normalizada permite:
- Reutilizar información de marca/modelo/componentes
- Registrar múltiples equipos del mismo tipo
- Asignar equipos a clientes cuando sea necesario
`);

