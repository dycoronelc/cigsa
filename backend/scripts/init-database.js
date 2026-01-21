// Script para inicializar la base de datos completa desde cero
import { initDatabase } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function initializeDatabase() {
  try {
    console.log('🚀 Inicializando base de datos...\n');
    
    // Esto crea la base de datos y ejecuta el schema.sql completo
    await initDatabase();
    console.log('\n✅ Schema base ejecutado correctamente');
    console.log('\n📝 Próximo paso: Ejecuta "npm run create-missing-tables" para crear tablas adicionales');
    console.log('📝 Luego ejecuta "npm run create-admin" para crear el usuario administrador');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    process.exit(1);
  }
}

initializeDatabase();
