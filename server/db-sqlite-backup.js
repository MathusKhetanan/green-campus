
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(dir, 'greencampus.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ========================================
// DATABASE TABLES
// ========================================

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- บัญชีเดิม
  student_id TEXT UNIQUE NOT NULL,
  pin_hash TEXT,

  -- บัญชีเกม
  username TEXT,
  password_hash TEXT,

  -- ข้อมูลผู้เล่น
  name TEXT NOT NULL,
  classroom TEXT NOT NULL DEFAULT '-',

  -- ความก้าวหน้า
  exp INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,

  -- ตัวละคร
  outfit TEXT NOT NULL DEFAULT
    '{"hair":"#3b2a20","shirt":"#2f9e5b","pants":"#2b4a7a","gender":"f"}',

  -- การยินยอมและวันที่สมัคร
  consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily','weekly','special')),
  category TEXT NOT NULL,
  points INTEGER NOT NULL,
  coins INTEGER NOT NULL,
  exp INTEGER NOT NULL,
  limit_n INTEGER NOT NULL DEFAULT 1,
  impact_value REAL NOT NULL DEFAULT 0,
  impact_unit TEXT NOT NULL DEFAULT 'ครั้ง',
  certificate INTEGER NOT NULL DEFAULT 0,
  ai_hint TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  image_file TEXT NOT NULL,
  image_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('approved','rejected','needs_review')
  ),
  ai_confidence REAL,
  ai_reason TEXT,
  ai_mode TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  pts_granted INTEGER NOT NULL DEFAULT 0,
  coins_granted INTEGER NOT NULL DEFAULT 0,
  exp_granted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS minigame_plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  game TEXT NOT NULL,
  points INTEGER NOT NULL,
  day TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL,
  stock INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  reward_id INTEGER NOT NULL REFERENCES rewards(id),
  cost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  given_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ========================================
// SAFE MIGRATION
// ========================================

const cols = table => {
  return db.prepare(`PRAGMA table_info(${table})`)
    .all()
    .map(column => column.name);
};

const addCol = (table, column, definition) => {
  if (!cols(table).includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

// บัญชีเกม
addCol('users', 'username', 'TEXT');
addCol('users', 'password_hash', 'TEXT');

// ข้อมูลความยินยอม
addCol('users', 'consent_at', 'TEXT');

// ข้อมูลการแลกรางวัล
addCol('redemptions', 'status', "TEXT NOT NULL DEFAULT 'pending'");
addCol('redemptions', 'given_at', 'TEXT');

// ข้อมูลคะแนนที่ให้จริง
addCol('submissions', 'pts_granted', 'INTEGER NOT NULL DEFAULT 0');
addCol('submissions', 'coins_granted', 'INTEGER NOT NULL DEFAULT 0');
addCol('submissions', 'exp_granted', 'INTEGER NOT NULL DEFAULT 0');

// ========================================
// INDEXES
// ========================================

// Username ต้องไม่ซ้ำกัน ไม่สนตัวพิมพ์เล็ก/ใหญ่
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON users(username COLLATE NOCASE)
  WHERE username IS NOT NULL AND username <> '';
`);

// ค้นหาข้อมูลผู้เล่น
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON sessions(user_id);

  CREATE INDEX IF NOT EXISTS idx_sub_user
  ON submissions(user_id, mission_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_minigame_user_day
  ON minigame_plays(user_id, day);

  CREATE INDEX IF NOT EXISTS idx_redemptions_user
  ON redemptions(user_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_certificates_user
  ON certificates(user_id);
`);

// ป้องกันใช้รูปหลักฐานซ้ำ
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_hash
  ON submissions(image_hash);
`);

// ========================================
// DEFAULT MISSIONS
// ========================================

if (db.prepare('SELECT COUNT(*) AS c FROM missions').get().c === 0) {
  const insert = db.prepare(`
    INSERT INTO missions (
      code, title, description, type, category,
      points, coins, exp, limit_n,
      impact_value, impact_unit, certificate, ai_hint
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const missions = [
    [
      'D_WASTE',
      'แยกขยะ 1 ครั้ง',
      'ทิ้งขยะลงถังที่ถูกประเภท แล้วถ่ายรูปให้เห็นถังและขยะ',
      'daily', 'waste', 15, 10, 20, 1,
      0.3, 'กก.', 0,
      'ภาพต้องเห็นการทิ้งหรือคัดแยกขยะลงถังแยกประเภทชัดเจน'
    ],
    [
      'D_LIGHT',
      'ปิดไฟเมื่อไม่ใช้งาน',
      'ปิดไฟหรืออุปกรณ์ไฟฟ้าในห้องที่ไม่มีคน',
      'daily', 'energy', 15, 10, 20, 1,
      1, 'ครั้ง', 0,
      'ภาพต้องเห็นสวิตช์ไฟหรือห้องที่ปิดไฟ'
    ],
    [
      'W_TREE',
      'ปลูกต้นไม้',
      'ปลูกต้นไม้ 1 ต้น ถ่ายรูปต้นไม้และการปลูก',
      'weekly', 'tree', 40, 25, 60, 2,
      1, 'ต้น', 1,
      'ภาพต้องเห็นต้นไม้ที่เพิ่งปลูกหรือกำลังปลูกในดิน'
    ],
    [
      'W_CLEAN',
      'เก็บขยะรอบวิทยาลัย',
      'เก็บขยะในพื้นที่วิทยาลัย',
      'weekly', 'cleanup', 30, 20, 40, 3,
      1, 'กก.', 0,
      'ภาพต้องเห็นขยะที่เก็บแล้วหรือกำลังเก็บขยะ'
    ],
    [
      'S_GREENWEEK',
      'Green Week: จิตอาสา',
      'ร่วมกิจกรรมจิตอาสาในสัปดาห์ Green Week',
      'special', 'volunteer', 50, 40, 100, 1,
      1, 'ครั้ง', 1,
      'ภาพต้องเห็นกิจกรรมจิตอาสาที่เกี่ยวกับสิ่งแวดล้อม'
    ]
  ];

  const insertMany = db.transaction(rows => {
    for (const row of rows) insert.run(...row);
  });

  insertMany(missions);
}

// ========================================
// DEFAULT REWARDS
// ========================================

if (db.prepare('SELECT COUNT(*) AS c FROM rewards').get().c === 0) {
  const insert = db.prepare(`
    INSERT INTO rewards (name, cost, stock)
    VALUES (?, ?, ?)
  `);

  const rewards = [
    ['พวงกุญแจ Green Campus', 80, 50],
    ['สมุดรักษ์โลก', 100, 40],
    ['ต้นไม้กระถางเล็ก', 150, 30],
    ['กระบอกน้ำ', 300, 20],
    ['กระเป๋าผ้ารักษ์โลก', 400, 15]
  ];

  const insertMany = db.transaction(rows => {
    for (const row of rows) insert.run(...row);
  });

  insertMany(rewards);
}

export default db;
