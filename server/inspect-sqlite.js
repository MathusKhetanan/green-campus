
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(dir, 'greencampus.db'), {
  readonly: true
});

try {
  const tables = db.prepare(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  console.log('\n========== SQLITE DATABASE ==========');
  console.log('จำนวนตาราง:', tables.length);

  for (const table of tables) {
    console.log(`\n========== ${table.name} ==========`);
    
    const columns = db.pragma(
      `table_info("${table.name.replace(/"/g, '""')}")`
    );

    const count = db.prepare(
      `SELECT COUNT(*) AS total FROM "${table.name.replace(/"/g, '""')}"`
    ).get();

    console.log('จำนวนข้อมูล:', count.total);
    console.log('โครงสร้างคอลัมน์:');

    for (const column of columns) {
      console.log({
        name: column.name,
        type: column.type,
        notnull: column.notnull,
        primaryKey: column.pk
      });
    }
  }

  console.log('\n========== INSPECTION COMPLETE ==========');

} catch (error) {
  console.error('ตรวจสอบไม่สำเร็จ:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
