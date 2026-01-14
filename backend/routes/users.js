import express from 'express';
import bcrypt from 'bcryptjs';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

const router = express.Router();

// Get all users
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const pool = await getConnection();
    const [users] = await pool.query(
      'SELECT id, username, email, role, full_name, phone, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const pool = await getConnection();
    const [users] = await pool.query(
      'SELECT id, username, email, role, full_name, phone, is_active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user
router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'user'), async (req, res) => {
  try {
    const { username, email, password, role, fullName, phone } = req.body;

    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ error: 'Username, email, password, and full name are required' });
    }

    const pool = await getConnection();

    // Check if username or email already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, full_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role || 'technician', fullName, phone || null]
    );

    res.status(201).json({ id: result.insertId, message: 'User created successfully' });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'user'), async (req, res) => {
  try {
    const { email, role, fullName, phone, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (fullName !== undefined) {
      updateFields.push('full_name = ?');
      updateValues.push(fullName);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.params.id);
    await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), activityLogger('DELETE', 'user'), async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

