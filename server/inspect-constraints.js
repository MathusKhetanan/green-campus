
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

  for (const table of tables) {
    console.log('\n================================');
    console.log('TABLE:', table.name);
    console.log('================================');

    console.log('\nCREATE TABLE SQL:');
    console.log(table.sql);

    const indexes = db.prepare(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'index'
        AND tbl_name = ?
        AND sql IS NOT NULL
    `).all(table.name);

    console.log('\nINDEXES:');
    console.log(indexes);

    const foreignKeys = db.pragma(
      `foreign_key_list("${table.name.replace(/"/g, '""')}")`
    );

    console.log('\nFOREIGN KEYS:');
    console.log(foreignKeys);
  }

  console.log('\nINSPECTION COMPLETE');

} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  db.close();
}
