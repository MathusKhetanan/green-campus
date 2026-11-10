
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
      database: process.env.TIDB_DATABASE,
      ssl: {
        minVersion: 'TLSv1.2'
      }
    });

    const [rows] = await connection.query(
      'SELECT VERSION() AS version, DATABASE() AS db'
    );

    console.log('เชื่อมต่อ TiDB สำเร็จ!');
    console.log(rows[0]);

  } catch (error) {
    console.error('เชื่อมต่อล้มเหลว:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
