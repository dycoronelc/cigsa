import { getConnection } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function associateManual() {
  try {
    const pool = await getConnection();
    const equipmentId = 200;
    const manualFileName = 'ZR-ZT110-275.pdf';
    
    // Ruta del archivo en la raíz del proyecto
    const sourcePath = path.join(__dirname, '..', '..', manualFileName);
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'documents');
    
    // Verificar que el archivo existe
    if (!fs.existsSync(sourcePath)) {
      console.error(`Error: El archivo ${manualFileName} no se encuentra en la raíz del proyecto`);
      process.exit(1);
    }
    
    // Verificar que el equipo existe
    const [equipment] = await pool.query('SELECT id FROM equipment WHERE id = ?', [equipmentId]);
    if (equipment.length === 0) {
      console.error(`Error: El equipo con ID ${equipmentId} no existe`);
      process.exit(1);
    }
    
    // Crear directorio de uploads si no existe
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Generar nombre único para el archivo
    const fileStats = fs.statSync(sourcePath);
    const uniqueFileName = `${Date.now()}-${manualFileName}`;
    const destPath = path.join(uploadsDir, uniqueFileName);
    
    // Copiar el archivo a uploads/documents
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Archivo copiado a: ${destPath}`);
    
    // Insertar registro en la base de datos
    const [result] = await pool.query(
      `INSERT INTO work_order_documents 
       (equipment_id, document_type, file_path, file_name, file_size, mime_type, description, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipmentId,
        'manual',
        `/uploads/documents/${uniqueFileName}`,
        manualFileName,
        fileStats.size,
        'application/pdf',
        'Manual Técnico del Equipo',
        null // Sistema
      ]
    );
    
    console.log(`\n✅ Manual técnico asociado exitosamente al equipo ID ${equipmentId}`);
    console.log(`   Documento ID: ${result.insertId}`);
    console.log(`   Archivo: ${manualFileName}`);
    console.log(`   Ruta: /uploads/documents/${uniqueFileName}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error al asociar manual:', error);
    process.exit(1);
  }
}

associateManual();

