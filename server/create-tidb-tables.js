
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: Number(process.env.TIDB_PORT || 4000),
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: 'green_campus',
      ssl: {
        minVersion: 'TLSv1.2'
      }
    });

    console.log('เชื่อมต่อฐานข้อมูล green_campus สำเร็จ');

    const tables = [

      // 1. USERS
      `CREATE TABLE IF NOT EXISTS users (
        id BIGINT NOT NULL AUTO_INCREMENT,
        student_id VARCHAR(191) NOT NULL,
        name TEXT NOT NULL,
        classroom VARCHAR(191) NOT NULL DEFAULT '-',
        exp BIGINT NOT NULL DEFAULT 0,
        points BIGINT NOT NULL DEFAULT 0,
        coins BIGINT NOT NULL DEFAULT 0,
        pin_hash VARCHAR(255),
        lifetime_points BIGINT NOT NULL DEFAULT 0,
        outfit TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        consent_at VARCHAR(64),
        username VARCHAR(191),
        password_hash VARCHAR(255),

        username_norm VARCHAR(191)
          GENERATED ALWAYS AS (
            CASE
              WHEN username IS NOT NULL AND username <> ''
              THEN LOWER(username)
              ELSE NULL
            END
          ) VIRTUAL,

        PRIMARY KEY (id),
        UNIQUE KEY uq_users_student_id (student_id),
        UNIQUE KEY idx_users_username (username_norm)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      // 2. MISSIONS
      `CREATE TABLE IF NOT EXISTS missions (
        id BIGINT NOT NULL AUTO_INCREMENT,
        code VARCHAR(191) NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        category VARCHAR(100) NOT NULL,
        points BIGINT NOT NULL,
        coins BIGINT NOT NULL,
        exp BIGINT NOT NULL,
        limit_n BIGINT NOT NULL DEFAULT 1,
        impact_value DOUBLE NOT NULL DEFAULT 0,
        impact_unit VARCHAR(100) NOT NULL DEFAULT 'ครั้ง',
        certificate TINYINT NOT NULL DEFAULT 0,
        ai_hint TEXT NOT NULL,
        active TINYINT NOT NULL DEFAULT 1,

        PRIMARY KEY (id),
        UNIQUE KEY uq_missions_code (code),
        CHECK (type IN ('daily','weekly','special'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      // 3. REWARDS
      `CREATE TABLE IF NOT EXISTS rewards (
        id BIGINT NOT NULL AUTO_INCREMENT,
        name TEXT NOT NULL,
        cost BIGINT NOT NULL,
        stock BIGINT NOT NULL,

        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      // 4. SESSIONS
      `CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(512) NOT NULL,
        user_id BIGINT,
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        created_at VARCHAR(64) NOT NULL,

        PRIMARY KEY (token),
        KEY idx_sessions_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      // 5. MINIGAME PLAYS
      `CREATE TABLE IF NOT EXISTS minigame_plays (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        game VARCHAR(191) NOT NULL,
        points BIGINT NOT NULL,
        day VARCHAR(32) NOT NULL,

        PRIMARY KEY (id),
        KEY idx_minigame_user_day (user_id, day)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      // 6. SUBMISSIONS
      `CREATE TABLE IF NOT EXISTS submissions (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        mission_id BIGINT NOT NULL,
        image_file TEXT NOT NULL,
        image_hash VARCHAR(255) NOT NULL,
        status VARCHAR(30) NOT NULL,
        ai_confidence DOUBLE,
        ai_reason TEXT,
        ai_mode VARCHAR(100),
        reviewed_by VARCHAR(191),
        reviewed_at VARCHAR(64),
        created_at VARCHAR(64) NOT NULL,
        pts_granted BIGINT NOT NULL DEFAULT 0,
        coins_granted BIGINT NOT NULL DEFAULT 0,
        exp_granted BIGINT NOT NULL DEFAULT 0,

        PRIMARY KEY (id),
        UNIQUE KEY idx_sub_hash (image_hash),
        KEY idx_sub_user (user_id, mission_id, created_at),

        CONSTRAINT fk_sub_user
          FOREIGN KEY (user_id) REFERENCES users(id),

        CONSTRAINT fk_sub_mission
          FOREIGN KEY (mission_id) REFERENCES missions(id),

        CHECK (
          status IN ('approved','rejected','needs_review')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      // 7. CERTIFICATES
      `CREATE TABLE IF NOT EXISTS certificates (
        id BIGINT NOT NULL AUTO_INCREMENT,
        serial VARCHAR(191) NOT NULL,
        user_id BIGINT NOT NULL,
        mission_id BIGINT NOT NULL,
        submission_id BIGINT NOT NULL,
        points BIGINT NOT NULL,
        created_at VARCHAR(64) NOT NULL,

        PRIMARY KEY (id),
        UNIQUE KEY uq_certificates_serial (serial),
        KEY idx_certificates_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      // 8. REDEMPTIONS
      `CREATE TABLE IF NOT EXISTS redemptions (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        reward_id BIGINT NOT NULL,
        cost BIGINT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        given_at VARCHAR(64),

        PRIMARY KEY (id),
        KEY idx_redemptions_user (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`

    ];

    for (const sql of tables) {
      await connection.query(sql);
    }

    console.log('\nสร้างตารางทั้ง 8 ตารางสำเร็จ!');

    const [rows] = await connection.query(`
      SHOW TABLES
    `);

    console.table(rows);

    if (rows.length !== 8) {
      throw new Error('จำนวนตารางไม่ตรงกับที่ต้องการ');
    }

    console.log('\nตรวจสอบเสร็จสมบูรณ์');

  } catch (error) {
    console.error('\nเกิดข้อผิดพลาด:', error.message);
    process.exitCode = 1;

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
