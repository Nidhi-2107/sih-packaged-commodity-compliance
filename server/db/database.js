import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSchema } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DB_PATH = process.env.DATABASE_PATH 
  ? path.resolve(process.env.DATABASE_PATH) 
  : path.join(__dirname, '..', '..', 'praman.db');

let db = null;
let SQL = null;

export async function initDb() {
  if (db) return db;
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // Ensure full schema and indexes are initialized idempotently
  createSchema();

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
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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
