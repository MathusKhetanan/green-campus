
import 'dotenv/config';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sqlitePath = path.join(dir, 'greencampus.db');

// ลำดับนี้รักษาความสัมพันธ์ของข้อมูล
const TABLES = [
  'users',
  'missions',
  'rewards',
  'sessions',
  'minigame_plays',
  'submissions',
  'certificates',
  'redemptions'
];

const quote = (name) => `\`${name.replace(/`/g, '``')}\``;

async function main() {
  let sqlite;
  let mysqlConnection;
  let transactionStarted = false;

  try {
    console.log('กำลังเปิดฐานข้อมูล...');

    sqlite = new Database(sqlitePath, {
      readonly: true,
      fileMustExist: true
    });

    mysqlConnection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: Number(process.env.TIDB_PORT || 4000),
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: 'green_campus',
      ssl: {
        minVersion: 'TLSv1.2'
      }
    });

    console.log('เชื่อมต่อ SQLite และ TiDB สำเร็จ');

    // ตรวจสอบว่าปลายทางว่างทุกตาราง
    console.log('\nตรวจสอบฐานข้อมูลปลายทาง...');

    for (const table of TABLES) {
      const [rows] = await mysqlConnection.query(
        `SELECT COUNT(*) AS total FROM ${quote(table)}`
      );

      const total = Number(rows[0].total);

      console.log(`${table}: ${total} รายการ`);

      if (total !== 0) {
        throw new Error(
          `ตาราง ${table} มีข้อมูลอยู่แล้ว หยุดเพื่อป้องกันข้อมูลซ้ำ`
        );
      }
    }

    // ตรวจสอบโครงสร้างและอ่านข้อมูลต้นทาง
    const source = {};

    for (const table of TABLES) {
      const columns = sqlite.pragma(
        `table_info(${quote(table).replace(/`/g, '"')})`
      );

      if (columns.length === 0) {
        throw new Error(`ไม่พบตาราง SQLite: ${table}`);
      }

      const primaryKeys = columns
        .filter(c => c.pk > 0)
        .sort((a, b) => a.pk - b.pk);

      if (primaryKeys.length === 0) {
        throw new Error(`ไม่พบ Primary Key: ${table}`);
      }

      const columnNames = columns.map(c => c.name);

      const rows = sqlite.prepare(
        `SELECT * FROM ${quote(table)}`
      ).all();

      source[table] = {
        columns: columnNames,
        primaryKeys: primaryKeys.map(c => c.name),
        rows
      };

      console.log(
        `ต้นทาง ${table}: ${rows.length} รายการ`
      );
    }

    // เริ่ม Transaction
    console.log('\nเริ่มย้ายข้อมูล...');

    await mysqlConnection.beginTransaction();
    transactionStarted = true;

    for (const table of TABLES) {
      const { columns, rows } = source[table];

      if (rows.length === 0) {
        console.log(`${table}: ไม่มีข้อมูล ข้ามการ INSERT`);
        continue;
      }

      const columnSQL = columns.map(quote).join(', ');
      const placeholders = columns.map(() => '?').join(', ');

      const insertSQL = `
        INSERT INTO ${quote(table)}
        (${columnSQL})
        VALUES (${placeholders})
      `;

      for (const row of rows) {
        const values = columns.map(column => row[column]);

        await mysqlConnection.execute(
          insertSQL,
          values
        );
      }

      console.log(
        `${table}: ย้าย ${rows.length} รายการสำเร็จ`
      );
    }

    // ตรวจสอบจำนวนและข้อมูลจริงทุกแถว
    console.log('\nกำลังตรวจสอบข้อมูลหลังย้าย...');

    for (const table of TABLES) {
      const { columns, primaryKeys, rows: sourceRows } =
        source[table];

      const orderSQL = primaryKeys.map(quote).join(', ');
      const columnSQL = columns.map(quote).join(', ');

      const [targetRows] = await mysqlConnection.query(
        `SELECT ${columnSQL}
         FROM ${quote(table)}
         ORDER BY ${orderSQL}`
      );

      const sortedSourceRows = [...sourceRows].sort((a, b) => {
        for (const key of primaryKeys) {
          const av = a[key];
          const bv = b[key];

          if (av < bv) return -1;
          if (av > bv) return 1;
        }
        return 0;
      });

      if (targetRows.length !== sourceRows.length) {
        throw new Error(
          `จำนวนข้อมูลไม่ตรงกัน: ${table}`
        );
      }

      for (let i = 0; i < sortedSourceRows.length; i++) {
        const sourceValues = columns.map(
          column => sortedSourceRows[i][column]
        );

        const targetValues = columns.map(
          column => targetRows[i][column]
        );

        if (
          JSON.stringify(sourceValues) !==
          JSON.stringify(targetValues)
        ) {
          throw new Error(
            `ข้อมูลไม่ตรงกัน: ${table} แถว ${i + 1}`
          );
        }
      }

      console.log(
        `ตรวจสอบ ${table}: ผ่าน (${sourceRows.length} รายการ)`
      );
    }

    // ยืนยัน Transaction เมื่อทุกอย่างผ่าน
    await mysqlConnection.commit();
    transactionStarted = false;

    console.log('\n================================');
    console.log('MIGRATION SUCCESS');
    console.log('================================');

    let total = 0;

    for (const table of TABLES) {
      const count = source[table].rows.length;
      total += count;

      console.log(`${table}: ${count}`);
    }

    console.log('-------------------------------');
    console.log(`รวมทั้งหมด: ${total} รายการ`);
    console.log('ตรวจสอบข้อมูลทุกแถว: ผ่าน');
    console.log('SQLite ต้นฉบับ: ไม่ถูกแก้ไข');
    console.log('TiDB: COMMIT สำเร็จ');

  } catch (error) {
    console.error('\nMIGRATION FAILED:', error.message);

    if (transactionStarted && mysqlConnection) {
      try {
        await mysqlConnection.rollback();
        console.log('Rollback สำเร็จ');
      } catch (rollbackError) {
        console.error(
          'Rollback error:',
          rollbackError.message
        );
      }
    }

    process.exitCode = 1;

  } finally {
    if (sqlite) sqlite.close();

    if (mysqlConnection) {
      await mysqlConnection.end();
    }
  }
}

main();
