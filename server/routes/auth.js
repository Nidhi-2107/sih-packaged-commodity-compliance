import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import { queryOne, runSql } from '../db/database.js';
import { createToken } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user && email.includes('@parakh.gov.in')) {
      user = queryOne('SELECT * FROM users WHERE email = ?', [email.replace('@parakh.gov.in', '@praman.gov.in')]);
    } else if (!user && email.includes('@praman.gov.in')) {
      user = queryOne('SELECT * FROM users WHERE email = ?', [email.replace('@praman.gov.in', '@parakh.gov.in')]);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcryptjs.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive. Contact administrator.' });
    }

    if (role && user.role !== role) {
      return res.status(401).json({ error: `This account does not have ${role} access.` });
    }

    // Update last login
    runSql('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);

    // Audit log
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [user.id, user.name, 'login', 'user', user.id, `${user.name} logged in`]
    );

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
        department: user.department,
        district: user.district,
        state: user.state
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const user = queryOne('SELECT id, name, email, role, employee_id, department, district, state, status, created_at, last_login FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  try {
    if (req.user) {
      runSql(
        'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
        [req.user.id, req.user.name, 'logout', 'user', req.user.id, `${req.user.name} logged out`]
      );
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
