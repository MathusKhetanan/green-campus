
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: Number(process.env.TIDB_PORT),
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: 'sys',
      ssl: {
        minVersion: 'TLSv1.2'
      }
    });

    await connection.query(
      'CREATE DATABASE IF NOT EXISTS green_campus'
    );

    const [rows] = await connection.query(
      'SHOW DATABASES LIKE ?',
      ['green_campus']
    );

    if (rows.length === 0) {
      throw new Error('ไม่พบฐานข้อมูล green_campus');
    }

    console.log('สร้างฐานข้อมูล green_campus สำเร็จ!');
    console.log(rows);

  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
