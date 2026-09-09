import { initDb, getDb, saveDb, queryAll, runSql } from '../server/db/database.js';

async function migrate() {
  await initDb();
  const db = getDb();

  console.log('Migrating declarations table...');
  // Check if evidence column exists
  const cols = queryAll('PRAGMA table_info(declarations)');
  const colNames = cols.map(c => c.name);
  console.log('Current columns:', colNames);

  // If status check constraint exists or evidence/source_image missing, rebuild table
  db.run(`
    CREATE TABLE IF NOT EXISTS declarations_new (
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
  `);

  // Copy existing data over
  const copyFields = colNames.filter(name => name !== 'evidence' && name !== 'source_image');
  const fieldsStr = copyFields.join(', ');
  db.run(`INSERT INTO declarations_new (${fieldsStr}) SELECT ${fieldsStr} FROM declarations;`);
  db.run(`DROP TABLE declarations;`);
  db.run(`ALTER TABLE declarations_new RENAME TO declarations;`);

  // Migrate ocr_results table as well to remove ocr_method check constraint
  const ocrCols = queryAll('PRAGMA table_info(ocr_results)').map(c => c.name);
  db.run(`
    CREATE TABLE IF NOT EXISTS ocr_results_new (
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
  `);
  const ocrFieldsStr = ocrCols.join(', ');
  db.run(`INSERT INTO ocr_results_new (${ocrFieldsStr}) SELECT ${ocrFieldsStr} FROM ocr_results;`);
  db.run(`DROP TABLE ocr_results;`);
  db.run(`ALTER TABLE ocr_results_new RENAME TO ocr_results;`);

  saveDb();

  // Test inserting not_detected with evidence
  runSql("INSERT INTO declarations (inspection_id, field_name, status, evidence, source_image) VALUES (?, ?, ?, ?, ?)",
    [99999, 'test_field', 'not_detected', 'Observed no MRP on back panel', 'back.jpg']);
  const testRow = queryAll("SELECT * FROM declarations WHERE inspection_id = 99999");
  console.log('Inserted row:', testRow);
  runSql("DELETE FROM declarations WHERE inspection_id = 99999");
  console.log('MIGRATION SUCCESSFUL!');
}

migrate().catch(console.error);
