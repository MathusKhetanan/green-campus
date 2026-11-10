import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import './env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { default: express } = await import('express');
const { default: multer } = await import('multer');
const { default: PDFDocument } = await import('pdfkit');
const { default: QRCode } = await import('qrcode');
const { default: db } = await import('./db.js');
const { checkEvidence } = await import('./ai.js');
const { LESSONS } = await import('./content.js');

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'teacher1234';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const UPLOAD_DIR = path.join(here, 'uploads');
if (ADMIN_CODE === 'teacher1234' && process.env.NODE_ENV === 'production') { console.error('❌ ห้ามใช้ ADMIN_CODE ค่าเริ่มต้นตอนใช้งานจริง แก้ในไฟล์ .env ก่อน'); process.exit(1); }
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 500;
const SUBMIT_PER_HOUR = 10;
const KEEP_DAYS = Number(process.env.IMAGE_KEEP_DAYS) || 30;
if (ADMIN_CODE === 'teacher1234') console.warn('⚠️  ยังใช้รหัสครูเริ่มต้น (teacher1234) กรุณาเปลี่ยน ADMIN_CODE ในไฟล์ .env ก่อนใช้งานจริง');
const GAME_DAILY_CAP = 20;
const GAME_MAX_PER_PLAY = 8;
const DEFAULT_OUTFIT = '{"hair":"#3b2a20","shirt":"#2f9e5b","pants":"#2b4a7a","gender":"f"}';

// ---------- เวลา ----------
// คอลัมน์เวลาใน TiDB เป็น VARCHAR รูปแบบ 'YYYY-MM-DD HH:MM:SS' (UTC) เหมือนข้อมูลที่ย้ายมาจาก SQLite
const TH = 7 * 3600e3;
const fmt = d => d.toISOString().slice(0, 19).replace('T', ' ');
const nowUtc = () => fmt(new Date());
const ago = ms => fmt(new Date(Date.now() - ms));
const thaiDay = (back = 0) => new Date(Date.now() + TH - back * 864e5).toISOString().slice(0, 10); // วันที่ไทย YYYY-MM-DD
const thaiDayStartUtc = (back = 0) => fmt(new Date(Date.parse(thaiDay(back) + 'T00:00:00Z') - TH)); // เที่ยงคืนเวลาไทย เป็น UTC

// ล้างเซสชันที่หมดอายุ
await db.run('DELETE FROM sessions WHERE created_at <= ?', [ago(30 * 864e5)]);

const app = express();
app.disable('x-powered-by');
app.get('/healthz', (_, res) => res.send('ok'));
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }); next(); });
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(here, '..', 'client')));
app.use('/admin', express.static(path.join(here, '..', 'admin')));

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_, f, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype)),
});

// Express 4 ไม่จับ error ของ async handler เอง ต้องห่อด้วยตัวนี้
const h = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- helpers ----------
const LEVELS = [[50, 'Green Master'], [30, 'Green Hero'], [20, 'Green Guardian'], [10, 'Green Explorer'], [5, 'Green Beginner'], [1, 'นักเรียนใหม่']];
const levelOf = exp => Math.floor(Math.sqrt(exp / 30)) + 1;
const expForLevel = lv => 30 * (lv - 1) ** 2;
const titleOf = lv => LEVELS.find(([n]) => lv >= n)[1];
const publicUser = u => {
  const level = levelOf(u.exp);
  return {
    id: u.id, studentId: u.student_id, name: u.name, classroom: u.classroom, exp: u.exp, level, title: titleOf(level),
    expThis: expForLevel(level), expNext: expForLevel(level + 1), points: u.points, coins: u.coins,
    lifetimePoints: u.lifetime_points, outfit: JSON.parse(u.outfit)
  };
};
// d = db หรือ ตัวแปรของ transaction (db.tx(async d => ...))
const award = (d, uid, points, coins, exp) => d.run(
  'UPDATE users SET points=points+?, lifetime_points=lifetime_points+?, coins=coins+?, exp=exp+? WHERE id=?',
  [points, points, coins, exp, uid]);

const hashPin = (pin, salt = crypto.randomBytes(8).toString('hex')) =>
  salt + ':' + crypto.scryptSync(pin, salt, 32).toString('hex');
const checkPin = (pin, stored) => {
  const [salt, hh] = stored.split(':');
  return crypto.timingSafeEqual(Buffer.from(hh, 'hex'), crypto.scryptSync(pin, salt, 32));
};

function auth(role) {
  return h(async (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
    const s = token && await db.get('SELECT * FROM sessions WHERE token=? AND created_at > ?', [token, ago(30 * 864e5)]);
    if (!s || (role && s.role !== role)) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    req.session = s;
    if (s.role === 'student') {
      req.user = await db.get('SELECT * FROM users WHERE id=?', [s.user_id]);
      if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }
    next();
  });
}
const student = auth('student'), teacher = auth('teacher');
const newToken = async (uid, role) => {
  const t = crypto.randomBytes(24).toString('hex');
  await db.run('INSERT INTO sessions (token,user_id,role,created_at) VALUES (?,?,?,?)', [t, uid, role, nowUtc()]);
  return t;
};

// จำนวนครั้งที่ทำภารกิจนี้ไปแล้วในรอบปัจจุบัน (เวลาไทย UTC+7)
async function usedCount(d, uid, m) {
  let sql = "SELECT COUNT(*) c FROM submissions WHERE user_id=? AND mission_id=? AND status IN ('approved','needs_review')";
  const p = [uid, m.id];
  if (m.type === 'daily') { sql += ' AND created_at >= ?'; p.push(thaiDayStartUtc(0)); }
  else if (m.type === 'weekly') { sql += ' AND created_at >= ?'; p.push(thaiDayStartUtc(6)); }
  return (await d.get(sql, p)).c;
}

async function grant(d, sub, m) {
  await award(d, sub.user_id, m.points, m.coins, m.exp);
  await d.run('UPDATE submissions SET pts_granted=?, coins_granted=?, exp_granted=? WHERE id=?', [m.points, m.coins, m.exp, sub.id]);
  if (m.certificate) {
    const serial = 'GC-' + new Date().getFullYear() + '-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    await d.run('INSERT INTO certificates (serial,user_id,mission_id,submission_id,points,created_at) VALUES (?,?,?,?,?,?)',
      [serial, sub.user_id, m.id, sub.id, m.points, nowUtc()]);
    return serial;
  }
  return null;
}

// ---------- auth ----------
const fails = new Map(), LOCK_MS = 15 * 60e3;
const tooMany = id => { const f = fails.get(id); return f && f.n >= 8 && Date.now() - f.t < LOCK_MS; };
const noteFail = id => { const f = fails.get(id); if (!f || Date.now() - f.t >= LOCK_MS) fails.set(id, { n: 1, t: Date.now() }); else { f.n++; f.t = Date.now(); } };

app.post('/api/login', h(async (req, res) => {
  const { name, classroom, pin, consent } = req.body || {};
  const studentId = String(req.body?.studentId || '').normalize('NFKC').replace(/[^\x21-\x7E]/g, '');
  if (!/^\d{11}$/.test(studentId)) return res.status(400).json({ error: 'รหัสนักเรียนต้องเป็นตัวเลข 11 หลัก' });
  if (tooMany(studentId)) return res.status(429).json({ error: 'ลองผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่' });
  if (!/^\d{4,6}$/.test(pin || '')) return res.status(400).json({ error: 'PIN ต้องเป็นตัวเลข 4-6 หลัก' });
  let u = await db.get('SELECT * FROM users WHERE student_id=?', [studentId]);
  if (!u) {
    if (!name || name.trim().length < 2) return res.status(400).json({ error: 'กรุณากรอกชื่อ' });
    if (consent !== true) return res.status(400).json({ error: 'ต้องติ๊กยินยอมการเก็บและใช้ข้อมูลก่อนสมัคร' });
    try {
      const now = nowUtc();
      const r = await db.run('INSERT INTO users (student_id,name,classroom,pin_hash,outfit,consent_at,created_at) VALUES (?,?,?,?,?,?,?)',
        [studentId, name.trim().slice(0, 60), (classroom || '-').trim().slice(0, 20), hashPin(pin), DEFAULT_OUTFIT, now, now]);
      u = await db.get('SELECT * FROM users WHERE id=?', [r.insertId]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'รหัสนักเรียนนี้ถูกสมัครแล้ว กรุณาลองเข้าสู่ระบบอีกครั้ง' });
      throw e;
    }
  } else if (!u.pin_hash || !checkPin(pin, u.pin_hash)) { noteFail(studentId); return res.status(401).json({ error: 'PIN ไม่ถูกต้อง' }); }
  fails.delete(studentId);
  res.json({ token: await newToken(u.id, 'student'), user: publicUser(u) });
}));

app.post('/api/admin/login', h(async (req, res) => {
  const k = 'admin:' + req.ip;
  if (tooMany(k)) return res.status(429).json({ error: 'ลองผิดหลายครั้ง กรุณารอ 15 นาที' });
  const a = Buffer.from(String(req.body?.code || '')), b = Buffer.from(ADMIN_CODE);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { noteFail(k); return res.status(401).json({ error: 'รหัสไม่ถูกต้อง' }); }
  fails.delete(k);
  res.json({ token: await newToken(null, 'teacher') });
}));

// ---------- Player Account Auth ----------
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) =>
  salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex');

const checkPassword = (password, stored) => {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const actual = Buffer.from(hash, 'hex');
  const expected = crypto.scryptSync(password, salt, 64);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

app.post('/api/register', h(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  const consent = req.body?.consent;

  if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username))
    return res.status(400).json({ error: 'Username ต้องมี 3-20 ตัวอักษร ใช้ภาษาอังกฤษ ตัวเลข _ หรือ .' });
  if (Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72)
    return res.status(400).json({ error: 'Password ต้องมีความยาว 8-72 ไบต์' });
  if (name.length < 2 || name.length > 30)
    return res.status(400).json({ error: 'ชื่อผู้เล่นต้องมี 2-30 ตัวอักษร' });
  if (consent !== true)
    return res.status(400).json({ error: 'กรุณายอมรับเงื่อนไขการจัดเก็บข้อมูลบัญชีเกม' });

  const key = 'register:' + username.toLowerCase();
  if (tooMany(key)) return res.status(429).json({ error: 'ลองสมัครหลายครั้งเกินไป กรุณารอ 15 นาที' });

  // username_norm = LOWER(username) เป็นคอลัมน์สร้างอัตโนมัติใน TiDB (UNIQUE) → ค้นด้วยตัวพิมพ์เล็ก
  const exists = await db.get('SELECT id FROM users WHERE username_norm=?', [username.toLowerCase()]);
  if (exists) { noteFail(key); return res.status(409).json({ error: 'Username นี้ถูกใช้งานแล้ว' }); }

  try {
    const playerCode = 'GC-' + crypto.randomBytes(12).toString('hex').toUpperCase();
    const now = nowUtc();
    const result = await db.run(
      `INSERT INTO users (student_id, username, password_hash, name, classroom, outfit, consent_at, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [playerCode, username, hashPassword(password), name, 'ผู้เล่นทั่วไป', DEFAULT_OUTFIT, now, now]);
    fails.delete(key);
    const user = await db.get('SELECT * FROM users WHERE id=?', [result.insertId]);
    return res.status(201).json({ token: await newToken(user.id, 'student'), user: publicUser(user), isNew: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username นี้ถูกใช้งานแล้ว' });
    console.error('Register error:', error);
    return res.status(500).json({ error: 'สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่' });
  }
}));

app.post('/api/player/login', h(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'กรุณากรอก Username และ Password' });

  const key = 'player:' + username.toLowerCase();
  if (tooMany(key)) return res.status(429).json({ error: 'เข้าสู่ระบบผิดหลายครั้ง กรุณารอ 15 นาที' });

  const user = await db.get('SELECT * FROM users WHERE username_norm=?', [username.toLowerCase()]);
  if (!user || !checkPassword(password, user.password_hash)) {
    noteFail(key);
    return res.status(401).json({ error: 'Username หรือ Password ไม่ถูกต้อง' });
  }
  fails.delete(key);
  return res.json({ token: await newToken(user.id, 'student'), user: publicUser(user), isNew: false });
}));

// ---------- player ----------
const BADGES = [
  { id: 'tree5', name: '🌱 นักปลูกมือใหม่', desc: 'ปลูกต้นไม้ 5 ต้น', cat: 'tree', need: 5 },
  { id: 'waste10', name: '♻️ นักแยกขยะ', desc: 'แยกขยะ 10 ครั้ง', cat: 'waste', need: 10 },
  { id: 'energy5', name: '💡 ผู้พิทักษ์พลังงาน', desc: 'ประหยัดพลังงาน 5 ครั้ง', cat: 'energy', need: 5 },
  { id: 'hero20', name: '🌎 Green Hero', desc: 'ทำกิจกรรมครบ 20 ครั้ง', cat: '*', need: 20 },
  { id: 'master1000', name: '🏆 Green Master', desc: 'สะสม Green Points 1,000', cat: '$', need: 1000 },
];
const impactOf = uid => db.all(
  `SELECT m.category, m.impact_unit AS unit, COUNT(*) AS \`count\`, ROUND(SUM(m.impact_value),1) AS total
   FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE s.user_id=? AND s.status='approved'
   GROUP BY m.category, m.impact_unit`, [uid]);

app.get('/api/me', student, h(async (req, res) => {
  const impact = await impactOf(req.user.id);
  const all = impact.reduce((a, i) => a + i.count, 0);
  const badges = BADGES.map(b => {
    const have = b.cat === '*' ? all : b.cat === '$' ? req.user.lifetime_points
      : impact.filter(i => i.category === b.cat).reduce((a, i) => a + i.count, 0);
    return { ...b, have: Math.min(have, b.need), earned: have >= b.need };
  });
  res.json({ user: publicUser(req.user), impact, badges });
}));

app.post('/api/outfit', student, h(async (req, res) => {
  const ok = c => /^#[0-9a-fA-F]{6}$/.test(c);
  const { hair, shirt, pants, gender } = req.body || {};
  if (![hair, shirt, pants].every(ok) || !['f', 'm'].includes(gender)) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  await db.run('UPDATE users SET outfit=? WHERE id=?', [JSON.stringify({ hair, shirt, pants, gender }), req.user.id]);
  res.json({ ok: true });
}));

// ---------- missions & evidence ----------
app.get('/api/missions', student, h(async (req, res) => {
  const rows = await db.all('SELECT * FROM missions WHERE active=1 ORDER BY type DESC, id');
  res.json(await Promise.all(rows.map(async m => ({
    id: m.id, title: m.title, description: m.description, type: m.type, category: m.category,
    points: m.points, coins: m.coins, exp: m.exp, certificate: !!m.certificate,
    used: await usedCount(db, req.user.id, m), limit: m.limit_n
  }))));
}));

app.post('/api/submissions', student, upload.single('image'), async (req, res) => {
  const file = req.file;
  const drop = () => { try { file && fs.existsSync(file.path) && fs.unlinkSync(file.path); } catch { } };
  try {
    if (!file) return res.status(400).json({ error: 'กรุณาแนบรูป (jpg/png/webp ไม่เกิน 6MB)' });
    const m = await db.get('SELECT * FROM missions WHERE id=? AND active=1', [Number(req.body.missionId)]);
    if (!m) { drop(); return res.status(404).json({ error: 'ไม่พบภารกิจ' }); }
    if (await usedCount(db, req.user.id, m) >= m.limit_n) { drop(); return res.status(409).json({ error: 'ภารกิจนี้ทำครบแล้วในรอบนี้' }); }

    const lastHour = (await db.get('SELECT COUNT(*) c FROM submissions WHERE user_id=? AND created_at > ?', [req.user.id, ago(3600e3)])).c;
    if (lastHour >= SUBMIT_PER_HOUR) { drop(); return res.status(429).json({ error: 'ส่งหลักฐานบ่อยเกินไป กรุณารอสักครู่' }); }
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');
    if (await db.get('SELECT 1 x FROM submissions WHERE image_hash=?', [hash])) {
      drop(); return res.status(409).json({ error: 'รูปนี้เคยถูกส่งแล้ว กรุณาถ่ายรูปใหม่' });
    }
    const aiToday = (await db.get("SELECT COUNT(*) c FROM submissions WHERE ai_mode='gemini' AND created_at >= ?", [thaiDayStartUtc(0)])).c;
    const ai = aiToday >= AI_DAILY_LIMIT
      ? { status: 'needs_review', confidence: 0, reason: 'โควต้า AI ของวันนี้เต็ม ส่งให้ครูตรวจ', mode: 'quota' }
      : await checkEvidence({ filePath: file.path, mime: file.mimetype, mission: m });

    // ตรวจซ้ำ + บันทึกใน transaction เดียว ล็อกแถวผู้ใช้ไว้ กันกดส่งหลายคำขอพร้อมกันเพื่อเอาคะแนนเกินโควตา
    const out = await db.tx(async d => {
      await d.get('SELECT id FROM users WHERE id=? FOR UPDATE', [req.user.id]);
      if (await usedCount(d, req.user.id, m) >= m.limit_n) return { err: 'ภารกิจนี้ทำครบแล้วในรอบนี้' };
      if (await d.get('SELECT 1 x FROM submissions WHERE image_hash=?', [hash])) return { err: 'รูปนี้เคยถูกส่งแล้ว กรุณาถ่ายรูปใหม่' };
      const r = await d.run(
        `INSERT INTO submissions (user_id,mission_id,image_file,image_hash,status,ai_confidence,ai_reason,ai_mode,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [req.user.id, m.id, file.filename, hash, ai.status, ai.confidence, ai.reason, ai.mode, nowUtc()]);
      const serial = ai.status === 'approved' ? await grant(d, { id: r.insertId, user_id: req.user.id }, m) : null;
      return { serial };
    });
    if (out.err) { drop(); return res.status(409).json({ error: out.err }); }
    if (ai.status === 'rejected') drop(); // ภาพที่ถูกปฏิเสธไม่ต้องเก็บไว้ (hash ยังอยู่กันส่งซ้ำ)
    res.json({
      status: ai.status, reason: ai.reason, mode: ai.mode,
      reward: ai.status === 'approved' ? { points: m.points, coins: m.coins, exp: m.exp } : null, certificate: out.serial
    });
  } catch (e) {
    drop();
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'รูปนี้เคยถูกส่งแล้ว กรุณาถ่ายรูปใหม่' });
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' });
  }
});

app.get('/api/submissions/mine', student, h(async (req, res) => res.json(await db.all(
  `SELECT s.id, s.status, s.ai_reason AS reason, s.created_at, m.title FROM submissions s JOIN missions m ON m.id=s.mission_id
   WHERE s.user_id=? ORDER BY s.id DESC LIMIT 30`, [req.user.id]))));

// ---------- lesson + mini game ----------
app.get('/api/lesson/:key', student, (req, res) => {
  const l = LESSONS[req.params.key]; if (!l) return res.status(404).json({ error: 'ไม่พบบทเรียน' });
  res.json({ title: l.title, pages: l.pages, items: l.items.map(({ n, e }) => ({ n, e })), quiz: l.quiz.map(({ q, c }) => ({ q, c })) });
});
app.post('/api/lesson/:key/submit', student, h(async (req, res) => {
  const l = LESSONS[req.params.key]; if (!l) return res.status(404).json({ error: 'ไม่พบบทเรียน' });
  const sort = req.body?.sort && typeof req.body.sort === 'object' ? req.body.sort : {};
  const quiz = Array.isArray(req.body?.quiz) ? req.body.quiz : [];
  const sortRight = l.items.filter(i => sort[i.n] === i.bin).length;
  const quizRight = l.quiz.filter((q, k) => quiz[k] === q.a).length;
  const raw = Math.round((sortRight / l.items.length + quizRight / l.quiz.length) / 2 * GAME_MAX_PER_PLAY);
  const today = thaiDay(0);
  const out = await db.tx(async d => {
    await d.get('SELECT id FROM users WHERE id=? FOR UPDATE', [req.user.id]); // กันปั๊มเกมพร้อมกัน
    const done = Number((await d.get('SELECT COALESCE(SUM(points),0) s FROM minigame_plays WHERE user_id=? AND day=?', [req.user.id, today])).s);
    const pts = Math.max(0, Math.min(raw, GAME_DAILY_CAP - done));
    await d.run('INSERT INTO minigame_plays (user_id,game,points,day) VALUES (?,?,?,?)', [req.user.id, req.params.key, pts, today]);
    const capped = pts < raw, coins = capped ? 0 : raw * 3, exp = capped ? 0 : raw * 2;
    await award(d, req.user.id, pts, coins, exp);
    return { points: pts, coins, exp, capped, sortRight, sortTotal: l.items.length, quizRight, quizTotal: l.quiz.length };
  });
  res.json(out);
}));

// ---------- shop ----------
app.get('/api/rewards', student, h(async (_, res) => res.json(await db.all('SELECT * FROM rewards ORDER BY cost'))));
app.post('/api/rewards/:id/redeem', student, h(async (req, res) => {
  const [code, msg] = await db.tx(async d => {
    const r = await d.get('SELECT * FROM rewards WHERE id=? FOR UPDATE', [req.params.id]);
    if (!r) return [404, 'ไม่พบของรางวัล'];
    if (r.stock < 1) return [409, 'ของรางวัลหมดแล้ว'];
    const u = await d.get('SELECT points FROM users WHERE id=? FOR UPDATE', [req.user.id]);
    if (u.points < r.cost) return [409, 'Green Points ไม่พอ'];
    await d.run('UPDATE users SET points=points-? WHERE id=?', [r.cost, req.user.id]);
    await d.run('UPDATE rewards SET stock=stock-1 WHERE id=?', [r.id]);
    await d.run('INSERT INTO redemptions (user_id,reward_id,cost,created_at) VALUES (?,?,?,?)', [req.user.id, r.id, r.cost, nowUtc()]);
    return [200, r.name];
  });
  res.status(code).json(code === 200 ? { ok: true, name: msg } : { error: msg });
}));

app.get('/api/redemptions/mine', student, h(async (req, res) => res.json(await db.all(
  `SELECT d.id, d.status, d.cost, d.created_at, r.name FROM redemptions d JOIN rewards r ON r.id=d.reward_id
   WHERE d.user_id=? ORDER BY d.id DESC LIMIT 10`, [req.user.id]))));

// ---------- ranking ----------
const mask = n => { const p = String(n).trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${[...p[p.length - 1]][0]}.` : p[0]; };
app.get('/api/leaderboard', student, h(async (_, res) => res.json({
  users: (await db.all('SELECT name, classroom, lifetime_points AS p FROM users WHERE lifetime_points > 0 ORDER BY p DESC LIMIT 20')).map(u => ({ ...u, name: mask(u.name) })),
  classes: await db.all('SELECT classroom AS name, SUM(lifetime_points) AS p, COUNT(*) AS n FROM users GROUP BY classroom ORDER BY p DESC LIMIT 10'),
})));

// ---------- certificates ----------
const certQuery = `SELECT c.*, u.name, m.title FROM certificates c
  JOIN users u ON u.id=c.user_id JOIN missions m ON m.id=c.mission_id`;
app.get('/api/certificates/mine', student, h(async (req, res) =>
  res.json(await db.all(certQuery + ' WHERE c.user_id=? ORDER BY c.id DESC', [req.user.id]))));

app.get('/api/certificates/:serial/pdf', h(async (req, res) => {
  const c = await db.get(certQuery + ' WHERE c.serial=?', [req.params.serial]);
  if (!c) return res.status(404).send('ไม่พบใบประกาศ');
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${c.serial}.pdf"`);
  doc.pipe(res);
  const W = doc.page.width, H = doc.page.height;
  doc.registerFont('R', path.join(here, 'fonts/Sarabun-Regular.ttf')).registerFont('B', path.join(here, 'fonts/Sarabun-Bold.ttf'));
  doc.rect(0, 0, W, H).fill('#f3fbf5');
  doc.lineWidth(6).strokeColor('#2f9e5b').rect(24, 24, W - 48, H - 48).stroke();
  doc.lineWidth(1.5).strokeColor('#ffc83d').rect(36, 36, W - 72, H - 72).stroke();
  doc.fillColor('#0f2a22').font('B').fontSize(40).text('GREEN CAMPUS CERTIFICATE', 0, 80, { align: 'center' });
  doc.font('R').fontSize(20).fillColor('#2f6b4a').text('ใบประกาศนียบัตรนี้มอบให้เพื่อแสดงว่า', 0, 150, { align: 'center' });
  doc.font('B').fontSize(46).fillColor('#0f2a22').text(c.name, 0, 190, { align: 'center' });
  doc.font('R').fontSize(20).fillColor('#2f6b4a').text('ได้ผ่านกิจกรรมด้านสิ่งแวดล้อม', 0, 262, { align: 'center' });
  doc.font('B').fontSize(28).fillColor('#2f9e5b').text(c.title, 0, 296, { align: 'center' });
  const d = new Date(c.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' });
  doc.font('R').fontSize(18).fillColor('#0f2a22').text(`วันที่ ${d}   ·   ได้รับ ${c.points} Green Points`, 0, 345, { align: 'center' });
  const qr = await QRCode.toBuffer(`${PUBLIC_URL}/verify/${c.serial}`, { margin: 1, width: 220 });
  doc.image(qr, 70, H - 190, { width: 110 });
  doc.font('R').fontSize(12).fillColor('#0f2a22').text('สแกนเพื่อตรวจสอบ', 70, H - 74, { width: 110, align: 'center' });
  doc.font('B').fontSize(14).text('เลขที่ ' + c.serial, 200, H - 120);
  doc.moveTo(W - 300, H - 110).lineTo(W - 80, H - 110).lineWidth(1).strokeColor('#0f2a22').stroke();
  doc.font('R').fontSize(14).text('ลงนาม / ตราวิทยาลัย', W - 300, H - 100, { width: 220, align: 'center' });
  doc.end();
}));

app.get('/verify/:serial', h(async (req, res) => {
  const c = await db.get(certQuery + ' WHERE c.serial=?', [req.params.serial]);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  res.type('html').send(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
  <body style="font-family:sans-serif;max-width:480px;margin:12vh auto;padding:0 20px;color:#0f2a22">
  ${c ? `<h1 style="color:#2f9e5b">✔ ใบประกาศถูกต้อง</h1><p><b>${esc(c.name)}</b></p><p>${esc(c.title)}</p>
         <p>เลขที่ ${esc(c.serial)}<br>ออกเมื่อ ${esc(c.created_at)} (UTC)</p>`
      : '<h1 style="color:#d64545">✘ ไม่พบใบประกาศนี้</h1><p>เลขที่ไม่ถูกต้องหรือไม่มีในระบบ</p>'}</body>`);
}));

// ---------- teacher/admin ----------
app.get('/api/admin/submissions', teacher, h(async (req, res) => res.json(await db.all(
  `SELECT s.id, s.status, s.ai_confidence AS conf, s.ai_reason AS reason, s.ai_mode AS mode, s.created_at, u.name, u.classroom, m.title
   FROM submissions s JOIN users u ON u.id=s.user_id JOIN missions m ON m.id=s.mission_id
   WHERE s.status=? ORDER BY s.id DESC LIMIT 100`, [req.query.status || 'needs_review']))));

app.get('/api/admin/image/:id', teacher, h(async (req, res) => {
  const s = await db.get('SELECT image_file FROM submissions WHERE id=?', [req.params.id]);
  const f = s && s.image_file && path.join(UPLOAD_DIR, path.basename(s.image_file));
  f && fs.existsSync(f) ? res.sendFile(f, { headers: { 'Content-Type': 'image/jpeg' } }) : res.sendStatus(404);
}));

app.post('/api/admin/submissions/:id/review', teacher, h(async (req, res) => {
  const approve = !!req.body?.approve;
  const ok = await db.tx(async d => {
    const s = await d.get('SELECT * FROM submissions WHERE id=? FOR UPDATE', [req.params.id]);
    if (!s || s.status !== 'needs_review') return false;
    const m = await d.get('SELECT * FROM missions WHERE id=?', [s.mission_id]);
    await d.run("UPDATE submissions SET status=?, reviewed_by='teacher', reviewed_at=? WHERE id=?", [approve ? 'approved' : 'rejected', nowUtc(), s.id]);
    if (approve) await grant(d, s, m);
    return true;
  });
  ok ? res.json({ ok: true }) : res.status(409).json({ error: 'รายการนี้ตรวจแล้วหรือไม่มีอยู่' });
}));

app.get('/api/admin/stats', teacher, h(async (_, res) => res.json({
  users: (await db.get('SELECT COUNT(*) c FROM users')).c,
  pendingRedeem: (await db.get("SELECT COUNT(*) c FROM redemptions WHERE status='pending'")).c,
  aiToday: (await db.get("SELECT COUNT(*) c FROM submissions WHERE ai_mode='gemini' AND created_at >= ?", [thaiDayStartUtc(0)])).c, aiLimit: AI_DAILY_LIMIT,
  byStatus: await db.all('SELECT status, COUNT(*) AS c FROM submissions GROUP BY status'),
  byCategory: await db.all(`SELECT m.category, COUNT(*) AS c FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE s.status='approved' GROUP BY m.category`),
})));

// ---- ครู: เพิกถอนรูปที่ AI เคยผ่าน ----
app.post('/api/admin/submissions/:id/revoke', teacher, h(async (req, res) => {
  const ok = await db.tx(async d => {
    const s = await d.get('SELECT * FROM submissions WHERE id=? FOR UPDATE', [req.params.id]);
    if (!s || s.status !== 'approved') return false;
    await d.run(`UPDATE users SET points=GREATEST(0,points-?), lifetime_points=GREATEST(0,lifetime_points-?), coins=GREATEST(0,coins-?), exp=GREATEST(0,exp-?) WHERE id=?`,
      [s.pts_granted, s.pts_granted, s.coins_granted, s.exp_granted, s.user_id]);
    await d.run('DELETE FROM certificates WHERE submission_id=?', [s.id]);
    await d.run("UPDATE submissions SET status='rejected', reviewed_by='teacher:revoked', reviewed_at=? WHERE id=?", [nowUtc(), s.id]);
    return true;
  });
  ok ? res.json({ ok: true }) : res.status(409).json({ error: 'รายการนี้ไม่ได้อยู่ในสถานะผ่าน' });
}));

// ---- ครู: ส่งมอบของรางวัล ----
app.get('/api/admin/redemptions', teacher, h(async (req, res) => res.json(await db.all(
  `SELECT d.id, d.status, d.cost, d.created_at, d.given_at, u.name, u.classroom, u.student_id, r.name AS reward
   FROM redemptions d JOIN users u ON u.id=d.user_id JOIN rewards r ON r.id=d.reward_id
   WHERE d.status=? ORDER BY d.id DESC LIMIT 200`, [req.query.status || 'pending']))));

app.post('/api/admin/redemptions/:id/give', teacher, h(async (req, res) => {
  const r = await db.run("UPDATE redemptions SET status='given', given_at=? WHERE id=? AND status='pending'", [nowUtc(), req.params.id]);
  r.affectedRows ? res.json({ ok: true }) : res.status(409).json({ error: 'รายการนี้ไม่ได้รอส่งมอบ' });
}));

app.post('/api/admin/redemptions/:id/cancel', teacher, h(async (req, res) => { // ยกเลิก = คืนคะแนนและสต็อก
  const ok = await db.tx(async d => {
    const r = await d.get("SELECT * FROM redemptions WHERE id=? AND status='pending' FOR UPDATE", [req.params.id]);
    if (!r) return false;
    await d.run('UPDATE users SET points=points+? WHERE id=?', [r.cost, r.user_id]);
    await d.run('UPDATE rewards SET stock=stock+1 WHERE id=?', [r.reward_id]);
    await d.run("UPDATE redemptions SET status='cancelled' WHERE id=?", [r.id]);
    return true;
  });
  ok ? res.json({ ok: true }) : res.status(409).json({ error: 'รายการนี้ไม่ได้รอส่งมอบ' });
}));

// ---- ครู: จัดการภารกิจ / ของรางวัล / นักเรียน ----
const toInt = (v, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null; };
const toStr = (v, max) => String(v ?? '').trim().slice(0, max);
const CATS = ['waste', 'energy', 'water', 'tree', 'cleanup', 'volunteer', 'other'];

app.get('/api/admin/missions', teacher, h(async (_, res) => res.json(await db.all('SELECT * FROM missions ORDER BY active DESC, type DESC, id'))));
app.post('/api/admin/missions', teacher, h(async (req, res) => {
  const b = req.body || {}, title = toStr(b.title, 80), desc = toStr(b.description, 300), hint = toStr(b.ai_hint, 400);
  const pts = toInt(b.points, 1, 200), coins = toInt(b.coins, 0, 200), exp = toInt(b.exp, 0, 500), lim = toInt(b.limit_n, 1, 50);
  if (title.length < 2 || desc.length < 4 || hint.length < 10) return res.status(400).json({ error: 'กรอกชื่อ คำอธิบาย และคำอธิบายรูปที่ถูกต้อง (ai_hint อย่างน้อย 10 ตัวอักษร)' });
  if (!['daily', 'weekly', 'special'].includes(b.type) || !CATS.includes(b.category) || [pts, coins, exp, lim].includes(null)) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  const r = await db.run(`INSERT INTO missions (code,title,description,type,category,points,coins,exp,limit_n,impact_value,impact_unit,certificate,ai_hint)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, ['M_' + crypto.randomBytes(3).toString('hex').toUpperCase(), title, desc, b.type, b.category, pts, coins, exp, lim,
    Number(b.impact_value) > 0 ? Number(b.impact_value) : 1, toStr(b.impact_unit, 12) || 'ครั้ง', b.certificate ? 1 : 0, hint]);
  res.json({ id: r.insertId });
}));
app.patch('/api/admin/missions/:id', teacher, h(async (req, res) => {
  const b = req.body || {}, set = [], vals = [];
  const add = (col, v) => { if (v !== null && v !== undefined && v !== '') { set.push(col + '=?'); vals.push(v); } };
  if ('title' in b) add('title', toStr(b.title, 80)); if ('description' in b) add('description', toStr(b.description, 300));
  if ('ai_hint' in b) add('ai_hint', toStr(b.ai_hint, 400).length >= 10 ? toStr(b.ai_hint, 400) : null);
  if ('points' in b) add('points', toInt(b.points, 1, 200)); if ('coins' in b) add('coins', toInt(b.coins, 0, 200));
  if ('exp' in b) add('exp', toInt(b.exp, 0, 500)); if ('limit_n' in b) add('limit_n', toInt(b.limit_n, 1, 50));
  if ('active' in b) add('active', b.active ? 1 : 0); if ('certificate' in b) add('certificate', b.certificate ? 1 : 0);
  if (!set.length) return res.status(400).json({ error: 'ไม่มีข้อมูลที่แก้ได้' });
  if (!await db.get('SELECT id FROM missions WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'ไม่พบภารกิจ' });
  await db.run(`UPDATE missions SET ${set.join(',')} WHERE id=?`, [...vals, req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/admin/rewards', teacher, h(async (_, res) => res.json(await db.all('SELECT * FROM rewards ORDER BY cost'))));
app.post('/api/admin/rewards', teacher, h(async (req, res) => {
  const name = toStr(req.body?.name, 60), cost = toInt(req.body?.cost, 1, 100000), stock = toInt(req.body?.stock, 0, 100000);
  if (name.length < 2 || cost === null || stock === null) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  res.json({ id: (await db.run('INSERT INTO rewards (name,cost,stock) VALUES (?,?,?)', [name, cost, stock])).insertId });
}));
app.patch('/api/admin/rewards/:id', teacher, h(async (req, res) => {
  const b = req.body || {}, cur = await db.get('SELECT * FROM rewards WHERE id=?', [req.params.id]);
  if (!cur) return res.status(404).json({ error: 'ไม่พบของรางวัล' });
  const name = 'name' in b ? toStr(b.name, 60) : cur.name, cost = 'cost' in b ? toInt(b.cost, 1, 100000) : cur.cost, stock = 'stock' in b ? toInt(b.stock, 0, 100000) : cur.stock;
  if (name.length < 2 || cost === null || stock === null) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  await db.run('UPDATE rewards SET name=?,cost=?,stock=? WHERE id=?', [name, cost, stock, cur.id]); res.json({ ok: true });
}));

app.get('/api/admin/users', teacher, h(async (req, res) => {
  const q = toStr(req.query.q, 40);
  res.json(await db.all(`SELECT id, student_id, name, classroom, points, lifetime_points FROM users
    WHERE ?='' OR INSTR(student_id,?)>0 OR INSTR(name,?)>0 OR INSTR(classroom,?)>0 ORDER BY id DESC LIMIT 50`, [q, q, q, q]));
}));
app.post('/api/admin/users/:id/reset-pin', teacher, h(async (req, res) => { // นักเรียนลืม PIN → ครูตั้ง PIN ใหม่ให้
  const pin = String(req.body?.pin || ''); if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN ต้องเป็นตัวเลข 4-6 หลัก' });
  if (!await db.get('SELECT id FROM users WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'ไม่พบนักเรียน' });
  await db.run('UPDATE users SET pin_hash=? WHERE id=?', [hashPin(pin), req.params.id]);
  await db.run("DELETE FROM sessions WHERE user_id=? AND role='student'", [req.params.id]); fails.clear(); res.json({ ok: true });
}));

// ---- ครู: ส่งออก CSV ----
const csvCell = v => { let t = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
const sendCsv = (res, name, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'));
};
app.get('/api/admin/export/:what', teacher, h(async (req, res) => {
  const w = req.params.what;
  if (w === 'users') return sendCsv(res, 'users.csv', [['รหัสนักเรียน', 'ชื่อ', 'ห้อง', 'Green Point คงเหลือ', 'คะแนนสะสม', 'EXP', 'Coin', 'ยินยอมเมื่อ (UTC)'],
  ...(await db.all('SELECT student_id,name,classroom,points,lifetime_points,exp,coins,consent_at FROM users ORDER BY classroom, student_id')).map(Object.values)]);
  if (w === 'submissions') return sendCsv(res, 'submissions.csv', [['เวลา (UTC)', 'รหัสนักเรียน', 'ชื่อ', 'ห้อง', 'ภารกิจ', 'สถานะ', 'AI มั่นใจ', 'ผู้ตรวจ'],
  ...(await db.all(`SELECT s.created_at,u.student_id,u.name,u.classroom,m.title,s.status,s.ai_confidence,s.reviewed_by FROM submissions s
      JOIN users u ON u.id=s.user_id JOIN missions m ON m.id=s.mission_id ORDER BY s.id DESC`)).map(Object.values)]);
  if (w === 'redemptions') return sendCsv(res, 'redemptions.csv', [['เวลา (UTC)', 'รหัสนักเรียน', 'ชื่อ', 'ห้อง', 'ของรางวัล', 'คะแนนที่ใช้', 'สถานะ', 'ส่งมอบเมื่อ (UTC)'],
  ...(await db.all(`SELECT d.created_at,u.student_id,u.name,u.classroom,r.name AS reward,d.cost,d.status,d.given_at FROM redemptions d
      JOIN users u ON u.id=d.user_id JOIN rewards r ON r.id=d.reward_id ORDER BY d.id DESC`)).map(Object.values)]);
  res.sendStatus(404);
}));

// ---- งานประจำวัน: ลบรูปหลักฐานที่เก่าเกินกำหนด (PDPA) ----
// การสำรองข้อมูล: ใช้ Backup ของ TiDB Cloud แทน (ไม่มีไฟล์ .db ให้ copy แล้ว)
async function cleanImages() {
  try {
    const rows = await db.all("SELECT id,image_file FROM submissions WHERE image_file<>'' AND status<>'needs_review' AND created_at < ?", [ago(KEEP_DAYS * 864e5)]);
    for (const r of rows) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(r.image_file))); } catch { }
      await db.run("UPDATE submissions SET image_file='' WHERE id=?", [r.id]);
    }
    if (rows.length) console.log(`ลบรูปหลักฐานที่เก่ากว่า ${KEEP_DAYS} วัน: ${rows.length} รูป`);
  } catch (e) { console.error('ลบรูปเก่าไม่สำเร็จ:', e.message); }
}
cleanImages(); setInterval(cleanImages, 24 * 3600e3).unref();

// ---- ตัวจัดการ error (ต้องอยู่หลังทุก route) ----
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'รูปใหญ่เกิน 6MB' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  console.error(err); res.status(500).json({ error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' });
});

app.listen(PORT, () => console.log(
  `Green Campus พร้อมแล้ว → http://localhost:${PORT}  (ครู: /admin)  DB: TiDB/${db.database}  AI: ${process.env.GEMINI_API_KEY ? 'Gemini' : 'โหมดส่งให้ครูตรวจ'}`
));