import { Router } from 'express';
import { queryAll, queryOne } from '../db/database.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// All admin routes require admin role
router.use(requireRole('admin'));

// GET /api/admin/dashboard — organization-wide statistics from actual data
router.get('/dashboard', (req, res) => {
  try {
    const totalInspections = queryOne('SELECT COUNT(*) as cnt FROM inspections')?.cnt || 0;
    const totalInspectors = queryOne('SELECT COUNT(*) as cnt FROM users WHERE role = "inspector"')?.cnt || 0;
    const totalBusinesses = queryOne('SELECT COUNT(DISTINCT business_id) as cnt FROM inspections')?.cnt || 0;
    const compliant = queryOne('SELECT COUNT(*) as cnt FROM inspections WHERE status = "compliant"')?.cnt || 0;
    const requiresReview = queryOne('SELECT COUNT(*) as cnt FROM inspections WHERE status = "requires_review"')?.cnt || 0;
    const potentialNonCompliance = queryOne('SELECT COUNT(*) as cnt FROM inspections WHERE status = "potential_non_compliance"')?.cnt || 0;
    const confirmedViolations = queryOne('SELECT COUNT(*) as cnt FROM violations WHERE status = "confirmed"')?.cnt || 0;
    const pendingReviews = queryOne('SELECT COUNT(*) as cnt FROM violations WHERE status = "pending"')?.cnt || 0;
    const avgScore = queryOne('SELECT AVG(compliance_score) as avg FROM inspections WHERE compliance_score IS NOT NULL')?.avg || 0;

    // Recent inspections
    const recentInspections = queryAll(`
      SELECT i.*, u.name as inspector_name, u.employee_id,
             b.name as business_name, p.name as product_name, p.category
      FROM inspections i
      LEFT JOIN users u ON i.inspector_id = u.id
      LEFT JOIN businesses b ON i.business_id = b.id
      LEFT JOIN products p ON i.product_id = p.id
      ORDER BY i.created_at DESC LIMIT 10
    `);

    // Monthly inspection counts (last 6 months)
    const monthlyData = queryAll(`
      SELECT strftime('%Y-%m', inspection_date) as month, COUNT(*) as count,
             AVG(compliance_score) as avg_score
      FROM inspections
      WHERE inspection_date >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', inspection_date)
      ORDER BY month
    `);

    // Violations by category
    const violationsByCategory = queryAll(`
      SELECT p.category, COUNT(v.id) as count
      FROM violations v
      JOIN inspections i ON v.inspection_id = i.id
      JOIN products p ON i.product_id = p.id
      GROUP BY p.category
      ORDER BY count DESC
    `);

    // Violations by district
    const violationsByDistrict = queryAll(`
      SELECT i.district, COUNT(v.id) as count
      FROM violations v
      JOIN inspections i ON v.inspection_id = i.id
      WHERE i.district IS NOT NULL AND i.district != ''
      GROUP BY i.district
      ORDER BY count DESC
    `);

    res.json({
      stats: {
        totalInspections,
        totalInspectors,
        totalBusinesses,
        compliant,
        requiresReview,
        potentialNonCompliance,
        confirmedViolations,
        pendingReviews,
        complianceRate: totalInspections > 0 ? Math.round((compliant / totalInspections) * 100) : 0,
        avgScore: Math.round(avgScore)
      },
      recentInspections,
      monthlyData,
      violationsByCategory,
      violationsByDistrict
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/admin/inspectors — inspector monitoring
router.get('/inspectors', (req, res) => {
  try {
    const inspectors = queryAll(`
      SELECT u.id, u.name, u.employee_id, u.district, u.state, u.status, u.last_login, u.created_at,
        (SELECT COUNT(*) FROM inspections WHERE inspector_id = u.id) as total_inspections,
        (SELECT COUNT(*) FROM inspections WHERE inspector_id = u.id AND status = 'compliant') as compliant_count,
        (SELECT COUNT(*) FROM violations v JOIN inspections i ON v.inspection_id = i.id WHERE i.inspector_id = u.id AND v.status = 'confirmed') as confirmed_violations,
        (SELECT AVG(compliance_score) FROM inspections WHERE inspector_id = u.id AND compliance_score IS NOT NULL) as avg_score
      FROM users u
      WHERE u.role = 'inspector'
      ORDER BY u.name
    `);

    res.json({ inspectors });
  } catch (error) {
    console.error('Admin inspectors error:', error);
    res.status(500).json({ error: 'Failed to fetch inspectors' });
  }
});

// GET /api/admin/inspectors/:id — individual inspector profile
router.get('/inspectors/:id', (req, res) => {
  try {
    const inspector = queryOne(`
      SELECT u.id, u.name, u.email, u.employee_id, u.department, u.district, u.state, u.status, u.last_login, u.created_at
      FROM users u WHERE u.id = ? AND u.role = 'inspector'
    `, [req.params.id]);

    if (!inspector) {
      return res.status(404).json({ error: 'Inspector not found' });
    }

    const stats = queryOne(`
      SELECT
        COUNT(*) as total_inspections,
        COUNT(CASE WHEN strftime('%Y-%m', inspection_date) = strftime('%Y-%m', 'now') THEN 1 END) as this_month,
        COUNT(CASE WHEN status = 'compliant' THEN 1 END) as compliant,
        COUNT(CASE WHEN status = 'requires_review' THEN 1 END) as requires_review,
        COUNT(CASE WHEN status = 'potential_non_compliance' THEN 1 END) as non_compliance,
        AVG(compliance_score) as avg_score
      FROM inspections WHERE inspector_id = ?
    `, [req.params.id]);

    const confirmedViolations = queryOne(
      'SELECT COUNT(*) as cnt FROM violations v JOIN inspections i ON v.inspection_id = i.id WHERE i.inspector_id = ? AND v.status = "confirmed"',
      [req.params.id]
    );

    const dismissedFindings = queryOne(
      'SELECT COUNT(*) as cnt FROM violations v JOIN inspections i ON v.inspection_id = i.id WHERE i.inspector_id = ? AND v.status = "dismissed"',
      [req.params.id]
    );

    const recentInspections = queryAll(`
      SELECT i.*, b.name as business_name, p.name as product_name, p.category
      FROM inspections i
      LEFT JOIN businesses b ON i.business_id = b.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.inspector_id = ?
      ORDER BY i.created_at DESC LIMIT 20
    `, [req.params.id]);

    res.json({
      inspector,
      stats: {
        ...stats,
        avg_score: Math.round(stats?.avg_score || 0),
        confirmed_violations: confirmedViolations?.cnt || 0,
        dismissed_findings: dismissedFindings?.cnt || 0
      },
      recentInspections
    });
  } catch (error) {
    console.error('Inspector profile error:', error);
    res.status(500).json({ error: 'Failed to fetch inspector profile' });
  }
});

// GET /api/admin/inspections — all inspections with filters
router.get('/inspections', (req, res) => {
  try {
    const { inspector_id, status, district, category, search, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT i.*, u.name as inspector_name, u.employee_id,
             b.name as business_name, p.name as product_name, p.category
      FROM inspections i
      LEFT JOIN users u ON i.inspector_id = u.id
      LEFT JOIN businesses b ON i.business_id = b.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (inspector_id) { sql += ' AND i.inspector_id = ?'; params.push(inspector_id); }
    if (status) { sql += ' AND i.status = ?'; params.push(status); }
    if (district) { sql += ' AND i.district = ?'; params.push(district); }
    if (category) { sql += ' AND p.category = ?'; params.push(category); }
    if (search) {
      sql += ' AND (i.inspection_number LIKE ? OR p.name LIKE ? OR b.name LIKE ? OR u.name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const inspections = queryAll(sql, params);
    const total = queryOne('SELECT COUNT(*) as cnt FROM inspections')?.cnt || 0;

    res.json({ inspections, total });
  } catch (error) {
    console.error('Admin inspections error:', error);
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

// GET /api/admin/violations — all violations with filters
router.get('/violations', (req, res) => {
  try {
    const { status, severity, search, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT v.*, r.rule_code, r.name as rule_name, r.legal_reference,
             i.inspection_number, i.inspection_date, i.district,
             u.name as inspector_name, u.employee_id,
             b.name as business_name, p.name as product_name
      FROM violations v
      LEFT JOIN rules r ON v.rule_id = r.id
      LEFT JOIN inspections i ON v.inspection_id = i.id
      LEFT JOIN users u ON i.inspector_id = u.id
      LEFT JOIN businesses b ON i.business_id = b.id
      LEFT JOIN products p ON i.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { sql += ' AND v.status = ?'; params.push(status); }
    if (severity) { sql += ' AND v.severity = ?'; params.push(severity); }
    if (search) {
      sql += ' AND (i.inspection_number LIKE ? OR p.name LIKE ? OR b.name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const violations = queryAll(sql, params);
    res.json({ violations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch violations' });
  }
});

// GET /api/admin/analytics — charts data from actual DB
router.get('/analytics', (req, res) => {
  try {
    const inspectionsOverTime = queryAll(`
      SELECT strftime('%Y-%m', inspection_date) as month,
             COUNT(*) as inspections,
             AVG(compliance_score) as avg_score,
             COUNT(CASE WHEN status = 'compliant' THEN 1 END) as compliant,
             COUNT(CASE WHEN status = 'potential_non_compliance' THEN 1 END) as non_compliant
      FROM inspections
      GROUP BY strftime('%Y-%m', inspection_date)
      ORDER BY month
    `);

    const categoryCompliance = queryAll(`
      SELECT p.category, COUNT(i.id) as inspections, AVG(i.compliance_score) as avg_score,
             COUNT(CASE WHEN i.status = 'compliant' THEN 1 END) as compliant
      FROM inspections i
      JOIN products p ON i.product_id = p.id
      GROUP BY p.category
    `);

    const districtStats = queryAll(`
      SELECT district, COUNT(*) as inspections, AVG(compliance_score) as avg_score,
             COUNT(CASE WHEN status = 'compliant' THEN 1 END) as compliant
      FROM inspections
      WHERE district IS NOT NULL AND district != ''
      GROUP BY district
    `);

    const inspectorActivity = queryAll(`
      SELECT u.name, u.employee_id, COUNT(i.id) as inspections,
             AVG(i.compliance_score) as avg_score
      FROM users u
      LEFT JOIN inspections i ON u.id = i.inspector_id
      WHERE u.role = 'inspector'
      GROUP BY u.id
      ORDER BY inspections DESC
    `);

    const violationTypes = queryAll(`
      SELECT r.name as rule_name, COUNT(v.id) as count
      FROM violations v
      JOIN rules r ON v.rule_id = r.id
      GROUP BY r.id
      ORDER BY count DESC
    `);

    res.json({
      inspectionsOverTime,
      categoryCompliance,
      districtStats,
      inspectorActivity,
      violationTypes
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/businesses — business list with stats
router.get('/businesses', (req, res) => {
  try {
    const businesses = queryAll(`
      SELECT b.*,
        (SELECT COUNT(*) FROM inspections WHERE business_id = b.id) as total_inspections,
        (SELECT AVG(compliance_score) FROM inspections WHERE business_id = b.id AND compliance_score IS NOT NULL) as avg_score,
        (SELECT COUNT(*) FROM violations v JOIN inspections i ON v.inspection_id = i.id WHERE i.business_id = b.id AND v.status = 'confirmed') as confirmed_violations,
        (SELECT MAX(inspection_date) FROM inspections WHERE business_id = b.id) as last_inspection
      FROM businesses b
      ORDER BY total_inspections DESC
    `);
    res.json({ businesses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// GET /api/admin/products — product list with stats
router.get('/products', (req, res) => {
  try {
    const products = queryAll(`
      SELECT p.*,
        (SELECT COUNT(*) FROM inspections WHERE product_id = p.id) as total_inspections,
        (SELECT AVG(compliance_score) FROM inspections WHERE product_id = p.id AND compliance_score IS NOT NULL) as avg_score,
        (SELECT MAX(inspection_date) FROM inspections WHERE product_id = p.id) as last_inspection
      FROM products p
      ORDER BY total_inspections DESC
    `);
    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/admin/audit-logs — audit logs
router.get('/audit-logs', (req, res) => {
  try {
    const { user_id, action, limit = 100, offset = 0 } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (user_id) { sql += ' AND user_id = ?'; params.push(user_id); }
    if (action) { sql += ' AND action = ?'; params.push(action); }

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = queryAll(sql, params);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
