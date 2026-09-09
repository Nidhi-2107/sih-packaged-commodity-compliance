import { getDb } from './database.js';

export function createSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('inspector', 'admin')),
      employee_id TEXT UNIQUE,
      department TEXT DEFAULT 'Legal Metrology',
      district TEXT,
      state TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      district TEXT,
      state TEXT,
      contact TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT,
      manufacturer TEXT,
      batch_number TEXT,
      sku TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_number TEXT UNIQUE NOT NULL,
      inspector_id INTEGER NOT NULL,
      business_id INTEGER,
      product_id INTEGER,
      inspection_date TEXT NOT NULL,
      inspection_type TEXT DEFAULT 'retail',
      district TEXT,
      state TEXT,
      latitude REAL,
      longitude REAL,
      compliance_score REAL,
      status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'compliant', 'requires_review', 'potential_non_compliance')),
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspector_id) REFERENCES users(id),
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      image_type TEXT DEFAULT 'front' CHECK(image_type IN ('front', 'back', 'side', 'additional')),
      original_name TEXT,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id)
    );

    CREATE TABLE IF NOT EXISTS ocr_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      image_id INTEGER,
      raw_text TEXT,
      ocr_confidence REAL,
      ocr_method TEXT DEFAULT 'vision_ai',
      processing_time_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id),
      FOREIGN KEY (image_id) REFERENCES inspection_images(id)
    );

    CREATE TABLE IF NOT EXISTS declarations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      extracted_value TEXT,
      confidence REAL,
      status TEXT DEFAULT 'detected',
      source_image_id INTEGER,
      source_image TEXT,
      evidence TEXT,
      is_informational INTEGER DEFAULT 0,
      verified_value TEXT,
      is_verified INTEGER DEFAULT 0,
      crop_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id),
      FOREIGN KEY (source_image_id) REFERENCES inspection_images(id)
    );

    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      legal_reference TEXT,
      category TEXT DEFAULT 'packaged_food',
      field_name TEXT NOT NULL,
      required INTEGER DEFAULT 1,
      severity TEXT DEFAULT 'major' CHECK(severity IN ('critical', 'major', 'minor', 'informational')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      rule_id INTEGER,
      declaration_id INTEGER,
      description TEXT,
      severity TEXT DEFAULT 'major',
      confidence REAL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'dismissed', 'manual_review')),
      evidence_image_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (inspection_id) REFERENCES inspections(id),
      FOREIGN KEY (rule_id) REFERENCES rules(id),
      FOREIGN KEY (declaration_id) REFERENCES declarations(id),
      FOREIGN KEY (evidence_image_id) REFERENCES inspection_images(id)
    );

    CREATE TABLE IF NOT EXISTS officer_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      violation_id INTEGER NOT NULL,
      officer_id INTEGER NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('confirmed', 'dismissed', 'manual_review')),
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (violation_id) REFERENCES violations(id),
      FOREIGN KEY (officer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL,
      report_data TEXT,
      generated_at TEXT DEFAULT (datetime('now')),
      generated_by INTEGER,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id),
      FOREIGN KEY (generated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_inspections_inspector ON inspections(inspector_id);
    CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
    CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(inspection_date);
    CREATE INDEX IF NOT EXISTS idx_violations_inspection ON violations(inspection_id);
    CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
    CREATE INDEX IF NOT EXISTS idx_declarations_inspection ON declarations(inspection_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
  `);

  // Safe migrations for existing databases
  try { db.run('ALTER TABLE declarations ADD COLUMN verified_value TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN is_verified INTEGER DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN crop_path TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN verified_by TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN verified_at TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN source_type TEXT DEFAULT "package_image"'); } catch (_) {}

  try { db.run('ALTER TABLE inspections ADD COLUMN qr_data TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN barcode_data TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN manufacturing_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN packing_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN expiry_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN use_by_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN best_before TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN shelf_life TEXT'); } catch (_) {}

  // Ensure food-specific Rule LMPC-010 (Best Before / Expiry) is seeded
  try {
    const existingRule = db.exec("SELECT id FROM rules WHERE rule_code = 'LMPC-010'");
    if (!existingRule || existingRule.length === 0 || !existingRule[0].values || existingRule[0].values.length === 0) {
      db.run(`INSERT INTO rules (rule_code, name, description, legal_reference, category, field_name, required, severity, active) 
              VALUES ('LMPC-010', 'Best Before or Expiry Date', 'For human food packages, the best before date/period or use-by/expiry date must be declared.', 'Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 6(1)(d)', 'packaged_food', 'best_before', 1, 'major', 1)`);
    }
  } catch (_) {}

  console.log('Database schema created successfully.');
}

export default { createSchema };
