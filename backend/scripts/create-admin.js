import bcrypt from 'bcryptjs';
import { getConnection } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  try {
    const pool = await getConnection();
    const username = process.argv[2] || 'admin';
    const password = process.argv[3] || 'admin123';
    const email = process.argv[4] || 'admin@cigsa.com';
    const fullName = process.argv[5] || 'Administrador';

    // Check if admin already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0) {
      console.log('Usuario administrador ya existe');
      process.exit(0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, full_name, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, 'admin', fullName, true]
    );

    console.log('Usuario administrador creado exitosamente!');
    console.log(`ID: ${result.insertId}`);
    console.log(`Usuario: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`Contraseña: ${password}`);
    console.log('\nPor favor, cambia la contraseña después del primer inicio de sesión.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error al crear usuario administrador:', error);
    process.exit(1);
  }
}

createAdmin();

