// ระบบภารกิจประจำวัน: หีบรางวัล + สตรีค (มีใบอภัยโทษ) + เป้าหมายร่วมของห้อง — คำนวณจากข้อมูลเดิมทั้งหมด
import crypto from 'crypto';

// นับสตรีคย้อนหลัง: ขาดได้ 1 วันต่อสัปดาห์ (ใบอภัยโทษ) และ "วันนี้ยังไม่ทำ" ไม่ถือว่าขาด
export const streakWith = thaiDay => days => {
  let n = 0, gap = null, start = null;
  for (let d = 0; d <= 60; d++) {
    if (days.has(thaiDay(d))) { n++; start = thaiDay(d); continue; }
    if (d === 0) continue;
    if ((gap === null || d - gap >= 7) && days.has(thaiDay(d + 1))) { gap = d; continue; }
    break;
  }
  return { n, start };
};

const MILE = { 3: [20, 15, 20], 7: [50, 30, 40], 14: [100, 60, 80], 30: [250, 120, 150] }; // [point, coin, exp]
const TIERS = [[60, 'ธรรมดา', 15, 10, 20], [30, 'หายาก', 25, 15, 30], [9, 'ยอดเยี่ยม', 40, 25, 50], [1, 'ตำนาน', 80, 50, 100]]; // [โอกาส%, ชื่อ, point, coin, exp]
const CLASS_REWARD = [30, 20, 30];
const roll = () => { let r = crypto.randomInt(100); for (const t of TIERS) { if (r < t[0]) return t; r -= t[0]; } return TIERS[0]; };

export async function registerQuests({ app, db, student, h, award, thaiDay, thaiDayStartUtc, TH, nowUtc }) {
  await db.run(`CREATE TABLE IF NOT EXISTS quest_claims (
    id BIGINT NOT NULL AUTO_INCREMENT, user_id BIGINT NOT NULL, kind VARCHAR(20) NOT NULL, ref VARCHAR(64) NOT NULL,
    points BIGINT NOT NULL, coins BIGINT NOT NULL, exp BIGINT NOT NULL DEFAULT 0, created_at VARCHAR(64) NOT NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_claim (user_id, kind, ref)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const streakOf = streakWith(thaiDay);
  const thDay = s => new Date(Date.parse(s.replace(' ', 'T') + 'Z') + TH).toISOString().slice(0, 10);
  const monday = day => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

  async function activeDays(uid) {
    const a = await db.all('SELECT DISTINCT day FROM minigame_plays WHERE user_id=? AND day>=?', [uid, thaiDay(60)]);
    const b = await db.all("SELECT created_at FROM submissions WHERE user_id=? AND status='approved' AND created_at>=?", [uid, thaiDayStartUtc(60)]);
    return new Set([...a.map(r => r.day), ...b.map(r => thDay(r.created_at))]);
  }

  async function state(u) {
    const day = thaiDay(0), wk = monday(day), since = thaiDayStartUtc(0);
    const g = await db.get('SELECT 1 x FROM minigame_plays WHERE user_id=? AND day=? LIMIT 1', [u.id, day]);
    const s = await db.get("SELECT 1 x FROM submissions WHERE user_id=? AND status='approved' AND created_at>=? LIMIT 1", [u.id, since]);
    const tasks = [
      { key: 'login', label: 'เข้าเกมวันนี้', hint: 'ได้อัตโนมัติ', done: true },
      { key: 'game', label: 'เล่นเกมแยกขยะ 1 รอบ', hint: 'ไปที่จุดคัดแยกขยะหรือ Game Zone', done: !!g },
      { key: 'real', label: 'ทำภารกิจจริง 1 ข้อ', hint: 'ส่งรูปหลักฐานให้ AI ตรวจผ่าน', done: !!s },
    ];
    const done = tasks.filter(t => t.done).length;
    const st = streakOf(await activeDays(u.id));
    const cl = new Set((await db.all("SELECT kind, ref FROM quest_claims WHERE user_id=? AND (kind='streak' OR (kind='chest' AND ref=?) OR (kind='class' AND ref=?))", [u.id, day, wk])).map(r => r.kind + '|' + r.ref));
    const milestones = Object.entries(MILE).map(([m, [points, coins, exp]]) => {
      const ref = `${m}:${st.start}`;
      return { m: +m, ref, points, coins, exp, state: st.n >= m ? (cl.has('streak|' + ref) ? 'claimed' : 'ready') : 'locked' };
    });
    let classGoal = null;
    if (u.classroom && u.classroom !== '-') {
      const wkStart = new Date(Date.parse(wk + 'T00:00:00Z') - TH).toISOString().slice(0, 19).replace('T', ' ');
      const count = (await db.get("SELECT COUNT(*) c FROM submissions s JOIN users x ON x.id=s.user_id WHERE x.classroom=? AND s.status='approved' AND s.created_at>=?", [u.classroom, wkStart])).c;
      const mine = (await db.get("SELECT COUNT(*) c FROM submissions WHERE user_id=? AND status='approved' AND created_at>=?", [u.id, wkStart])).c;
      const members = (await db.get('SELECT COUNT(*) c FROM users WHERE classroom=?', [u.classroom])).c;
      const target = Math.max(10, Math.min(60, members * 2)), claimed = cl.has('class|' + wk);
      classGoal = { classroom: u.classroom, count, target, mine, claimed, claimable: count >= target && mine >= 1 && !claimed, points: CLASS_REWARD[0], coins: CLASS_REWARD[1], ref: wk };
    }
    return { day, tasks, done, chest: { ready: done === 3 && !cl.has('chest|' + day), claimed: cl.has('chest|' + day) }, streak: { n: st.n, milestones }, classGoal };
  }

  // รับรางวัล 1 ครั้งต่อ (ผู้เล่น, ชนิด, อ้างอิง) — ล็อกผู้เล่นและมี UNIQUE กันกดซ้ำ/ปั๊ม
  const claim = (uid, kind, ref, [p, c, e]) => db.tx(async d => {
    await d.get('SELECT id FROM users WHERE id=? FOR UPDATE', [uid]);
    if (await d.get('SELECT id FROM quest_claims WHERE user_id=? AND kind=? AND ref=?', [uid, kind, ref])) return { error: 'รับรางวัลนี้ไปแล้ว', status: 409 };
    await d.run('INSERT INTO quest_claims (user_id,kind,ref,points,coins,exp,created_at) VALUES (?,?,?,?,?,?,?)', [uid, kind, ref, p, c, e, nowUtc()]);
    await award(d, uid, p, c, e);
    return { points: p, coins: c, exp: e };
  });
  const send = (res, r, extra = {}) => r.error ? res.status(r.status).json({ error: r.error }) : res.json({ ...r, ...extra });

  app.get('/api/quests', student, h(async (req, res) => res.json(await state(req.user))));

  app.post('/api/quests/chest/claim', student, h(async (req, res) => {
    const s = await state(req.user);
    if (!s.chest.ready) return res.status(400).json({ error: s.chest.claimed ? 'วันนี้เปิดหีบไปแล้ว' : 'ยังทำภารกิจวันนี้ไม่ครบ' });
    const t = roll(); send(res, await claim(req.user.id, 'chest', s.day, [t[2], t[3], t[4]]), { tier: t[1] });
  }));

  app.post('/api/quests/streak/:m/claim', student, h(async (req, res) => {
    const m = (await state(req.user)).streak.milestones.find(x => x.m === Number(req.params.m));
    if (!m || m.state !== 'ready') return res.status(400).json({ error: 'ยังรับรางวัลนี้ไม่ได้' });
    send(res, await claim(req.user.id, 'streak', m.ref, MILE[m.m]));
  }));

  app.post('/api/quests/class/claim', student, h(async (req, res) => {
    const g = (await state(req.user)).classGoal;
    if (!g || !g.claimable) return res.status(400).json({ error: 'ยังรับรางวัลนี้ไม่ได้' });
    send(res, await claim(req.user.id, 'class', g.ref, CLASS_REWARD));
  }));
}