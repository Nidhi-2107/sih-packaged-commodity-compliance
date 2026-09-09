import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import { queryAll, queryOne, runSql, getLastInsertId } from '../db/database.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/users — list users (admin only)
router.get('/', requireRole('admin'), (req, res) => {
  try {
    const users = queryAll(
      'SELECT id, name, email, role, employee_id, department, district, state, status, last_login, created_at FROM users ORDER BY name'
    );
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users — create user (admin only)
router.post('/', requireRole('admin'), (req, res) => {
  try {
    const { name, email, password, role, employee_id, department, district, state } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const password_hash = bcryptjs.hashSync(password, 10);
    runSql(
      'INSERT INTO users (name, email, password_hash, role, employee_id, department, district, state, status) VALUES (?,?,?,?,?,?,?,?,?)',
      [name, email, password_hash, role || 'inspector', employee_id || '', department || 'Legal Metrology', district || '', state || '', 'active']
    );

    const id = getLastInsertId();

    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, 'user_created', 'user', id, `User ${name} (${email}) created with role ${role || 'inspector'}`]
    );

    res.status(201).json({ id, message: 'User created' });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id — update user (admin only)
router.put('/:id', requireRole('admin'), (req, res) => {
  try {
    const { name, status, district, state, password } = req.body;
    const existing = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (district) { updates.push('district = ?'); params.push(district); }
    if (state) { updates.push('state = ?'); params.push(state); }
    if (password) {
      updates.push('password_hash = ?');
      params.push(bcryptjs.hashSync(password, 10));
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No updates' });

    params.push(req.params.id);
    runSql(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, 'user_updated', 'user', req.params.id, `User ${existing.name} updated`]
    );

    res.json({ message: 'User updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
