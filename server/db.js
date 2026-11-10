// เชื่อมต่อ TiDB Cloud (MySQL) ด้วย mysql2 — แทน better-sqlite3 เดิม
// ต้อง import './env.js' ก่อนไฟล์นี้ (index.js ทำให้อยู่แล้ว)
import mysql from 'mysql2/promise';

// .env เดิมตั้ง TIDB_DATABASE=sys ซึ่งไม่ใช่ฐานข้อมูลของเกม จึงใช้ green_campus เมื่อเจอค่า sys
const envDb = process.env.TIDB_DATABASE;
const DATABASE = envDb && envDb !== 'sys' ? envDb : 'green_campus';

export const pool = mysql.createPool({
  host: process.env.TIDB_HOST,
  port: Number(process.env.TIDB_PORT || 4000),
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: DATABASE,
  ssl: { minVersion: 'TLSv1.2' },
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  decimalNumbers: true, // SUM()/ROUND() คืนเป็นตัวเลข ไม่ใช่สตริง
});

// ตัวช่วยเรียก SQL ใช้ได้ทั้งกับ pool และ connection ใน transaction
const make = ex => ({
  all: async (sql, params = []) => (await ex.query(sql, params))[0],         // หลายแถว
  get: async (sql, params = []) => (await ex.query(sql, params))[0][0],      // แถวเดียว (หรือ undefined)
  run: async (sql, params = []) => (await ex.query(sql, params))[0],         // INSERT/UPDATE/DELETE → { insertId, affectedRows }
});

async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(make(conn));
    await conn.commit();
    return result;
  } catch (e) {
    try { await conn.rollback(); } catch { }
    throw e;
  } finally {
    conn.release();
  }
}

const db = { ...make(pool), tx, pool, database: DATABASE };
export default db;