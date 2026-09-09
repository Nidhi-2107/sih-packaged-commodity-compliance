import { initDb, runSql, queryAll } from '../server/db/database.js';

async function test() {
  await initDb();
  try {
    runSql("INSERT INTO declarations (inspection_id, field_name, status) VALUES (?, ?, ?)", [99999, 'test', 'not_detected']);
    console.log('SUCCESS: inserted not_detected');
    runSql("DELETE FROM declarations WHERE inspection_id = 99999");
  } catch (e) {
    console.log('FAILED:', e.message);
  }
}
test();
