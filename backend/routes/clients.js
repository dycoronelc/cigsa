import express from 'express';
import { getConnection } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { activityLogger } from '../middleware/logger.js';

const router = express.Router();

// Get all clients
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [clients] = await pool.query(
      'SELECT * FROM clients WHERE is_active = TRUE ORDER BY name'
    );
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get client by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const [clients] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);

    if (clients.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(clients[0]);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create client
router.post('/', authenticateToken, requireRole('admin'), activityLogger('CREATE', 'client'), async (req, res) => {
  try {
    const { name, companyName, email, phone, address, contactPerson } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Client name is required' });
    }

    const pool = await getConnection();
    const [result] = await pool.query(
      'INSERT INTO clients (name, company_name, email, phone, address, contact_person) VALUES (?, ?, ?, ?, ?, ?)',
      [name, companyName || null, email || null, phone || null, address || null, contactPerson || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Client created successfully' });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update client
router.put('/:id', authenticateToken, requireRole('admin'), activityLogger('UPDATE', 'client'), async (req, res) => {
  try {
    const { name, companyName, email, phone, address, contactPerson, isActive } = req.body;
    const pool = await getConnection();

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (companyName !== undefined) {
      updateFields.push('company_name = ?');
      updateValues.push(companyName);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }
    if (contactPerson !== undefined) {
      updateFields.push('contact_person = ?');
      updateValues.push(contactPerson);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.params.id);
    await pool.query(`UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete client (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), activityLogger('DELETE', 'client'), async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.query('UPDATE clients SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Client deactivated successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

