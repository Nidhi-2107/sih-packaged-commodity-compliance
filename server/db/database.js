import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', '..', 'praman.db');

let db = null;
let SQL = null;

export async function initDb() {
  if (db) return db;
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // Automatic column migrations
  try { db.run('ALTER TABLE declarations ADD COLUMN verified_value TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN is_verified INTEGER DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN crop_path TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN evidence TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN source_image TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN source_type TEXT DEFAULT "printed"'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN verified_by TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE declarations ADD COLUMN verified_at TEXT'); } catch (_) {}

  try { db.run('ALTER TABLE inspections ADD COLUMN qr_data TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN barcode_data TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN manufacturing_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN packing_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN expiry_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN use_by_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN best_before TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE inspections ADD COLUMN shelf_life TEXT'); } catch (_) {}

  // Ensure food-specific Rule LMPC-010 is seeded
  try {
    const existingRule = db.exec("SELECT id FROM rules WHERE rule_code = 'LMPC-010'");
    if (!existingRule || existingRule.length === 0 || !existingRule[0].values || existingRule[0].values.length === 0) {
      db.run(`INSERT INTO rules (rule_code, name, description, legal_reference, category, field_name, required, severity, active) 
              VALUES ('LMPC-010', 'Best Before or Expiry Date', 'For human food packages, the best before date/period or use-by/expiry date must be declared.', 'Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 6(1)(d)', 'packaged_food', 'best_before', 1, 'major', 1)`);
    }
  } catch (_) {}

  saveDb();

  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

// Helper to run queries and get results as array of objects
export function queryAll(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

let currentLastInsertId = 0;

export function runSql(sql, params = []) {
  const d = getDb();
  d.run(sql, params);
  try {
    const res = d.exec('SELECT last_insert_rowid() as id');
    if (res[0]?.values[0]?.[0] !== undefined) {
      currentLastInsertId = res[0].values[0][0];
    }
  } catch (e) {
    console.error('Failed to get last_insert_rowid:', e);
  }
  saveDb();
  return d.getRowsModified();
}

export function execSql(sql) {
  const d = getDb();
  d.exec(sql);
  saveDb();
}

export function getLastInsertId() {
  return currentLastInsertId;
}

export default { initDb, getDb, saveDb, closeDb, queryAll, queryOne, runSql, execSql, getLastInsertId };
