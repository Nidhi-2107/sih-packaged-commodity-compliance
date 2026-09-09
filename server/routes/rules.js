import { Router } from 'express';
import { queryAll, queryOne, runSql, getLastInsertId } from '../db/database.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/rules — list all rules (any authenticated user can view)
router.get('/', (req, res) => {
  try {
    const rules = queryAll('SELECT * FROM rules ORDER BY rule_code');
    res.json({ rules });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// POST /api/rules — add rule (admin only)
router.post('/', requireRole('admin'), (req, res) => {
  try {
    const { rule_code, name, description, legal_reference, category, field_name, required, severity } = req.body;

    if (!rule_code || !name || !field_name) {
      return res.status(400).json({ error: 'Rule code, name, and field name are required' });
    }

    runSql(
      'INSERT INTO rules (rule_code, name, description, legal_reference, category, field_name, required, severity, active) VALUES (?,?,?,?,?,?,?,?,1)',
      [rule_code, name, description || '', legal_reference || '', category || 'packaged_food', field_name, required ? 1 : 0, severity || 'major']
    );

    const id = getLastInsertId();

    // Audit log
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, 'rule_created', 'rule', id, `Rule ${rule_code}: ${name} created`]
    );

    res.status(201).json({ id, message: 'Rule created' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// PUT /api/rules/:id — update rule (admin only)
router.put('/:id', requireRole('admin'), (req, res) => {
  try {
    const { name, description, legal_reference, category, field_name, required, severity, active } = req.body;

    const existing = queryOne('SELECT * FROM rules WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    runSql(
      `UPDATE rules SET name = ?, description = ?, legal_reference = ?, category = ?, field_name = ?, required = ?, severity = ?, active = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        name || existing.name,
        description !== undefined ? description : existing.description,
        legal_reference !== undefined ? legal_reference : existing.legal_reference,
        category || existing.category,
        field_name || existing.field_name,
        required !== undefined ? (required ? 1 : 0) : existing.required,
        severity || existing.severity,
        active !== undefined ? (active ? 1 : 0) : existing.active,
        req.params.id
      ]
    );

    // Audit log
    runSql(
      'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, timestamp) VALUES (?,?,?,?,?,?,datetime("now"))',
      [req.user.id, req.user.name, 'rule_updated', 'rule', req.params.id, `Rule ${existing.rule_code} updated`]
    );

    res.json({ message: 'Rule updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

export default router;
