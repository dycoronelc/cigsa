/**
 * Ejecuta la migración de componentes (mismo contenido que migrate-components.sql).
 * Uso: desde backend/ → node scripts/migrate-components.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const sqlPath = path.join(__dirname, 'migrate-components.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--') && !s.startsWith('USE '));

  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cigsa_db',
    multipleStatements: true
  });

  console.log('Migrando componentes en', process.env.DB_NAME || 'cigsa_db', '...\n');

  for (const stmt of statements) {
    if (stmt.startsWith('SET @') || stmt.startsWith('PREPARE') || stmt.startsWith('EXECUTE') || stmt.startsWith('DEALLOCATE')) {
      try {
        await pool.query(stmt);
      } catch (e) {
        if (!String(e.message).includes('Duplicate')) console.warn('Skip:', e.message);
      }
      continue;
    }
    try {
      const [result] = await pool.query(stmt);
      if (stmt.startsWith('SELECT')) {
        console.log(result);
      }
    } catch (e) {
      const msg = e.sqlMessage || e.message || '';
      if (msg.includes('Duplicate') || msg.includes('already exists')) {
        console.log('OK (ya existía):', stmt.slice(0, 60) + '...');
      } else {
        console.error('Error:', msg, '\n', stmt.slice(0, 120));
        throw e;
      }
    }
  }

  await pool.end();
  console.log('\nMigración finalizada.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
