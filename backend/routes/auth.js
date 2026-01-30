import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConnection } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../middleware/logger.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const pool = await getConnection();
    const [users] = await pool.query(
      'SELECT id, username, email, password_hash, role, full_name, is_active FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    await logActivity(user.id, 'LOGIN', 'user', user.id, 'User logged in', req.ip);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [users] = await pool.query(
      'SELECT id, username, email, role, full_name, phone, is_active FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      phone: user.phone,
      isActive: user.is_active
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    const pool = await getConnection();
    const [users] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, req.user.id]);

    await logActivity(req.user.id, 'CHANGE_PASSWORD', 'user', req.user.id, 'Password changed', req.ip);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password (forgot password) - requires username + email
router.post('/reset-password', async (req, res) => {
  try {
    const { username, email, newPassword } = req.body;

    if (!username || !email || !newPassword) {
      return res.status(400).json({ error: 'Username, email and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const pool = await getConnection();
    const [users] = await pool.query(
      'SELECT id, is_active FROM users WHERE username = ? AND email = ? LIMIT 1',
      [username, email]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario y correo no coinciden' });
    }

    if (!users[0].is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, users[0].id]);

    await logActivity(users[0].id, 'RESET_PASSWORD', 'user', users[0].id, 'Password reset', req.ip);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

