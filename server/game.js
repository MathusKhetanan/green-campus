// สวน (ปลูก/ตกแต่ง) + กระเป๋า + ตู้เสื้อผ้า + ร้านเหรียญ — เหรียญใช้ซื้อของในส่วนนี้ ส่วน Point ยังใช้แลกของจริงเหมือนเดิม
export const SEEDS = {
  seed_flower: { name: 'เมล็ดดอกไม้', e: '🌷', cost: 10, min: 30, coins: 14, exp: 3 },
  seed_veg: { name: 'เมล็ดผักสวนครัว', e: '🥬', cost: 20, min: 180, coins: 36, exp: 8 },
  seed_tree: { name: 'ต้นกล้า', e: '🌳', cost: 40, min: 1440, coins: 80, exp: 20 },
};
export const DECOR = {
  d_fence: { name: 'รั้วไม้', e: '🪵', cost: 30 }, d_bench: { name: 'ม้านั่ง', e: '🪑', cost: 60 },
  d_lamp: { name: 'โคมไฟสวน', e: '💡', cost: 50 }, d_pond: { name: 'บ่อน้ำ', e: '🪷', cost: 120 },
};
export const WEAR = {
  cap: { slot: 'hat', name: 'หมวกแก๊ป', e: '🧢', cost: 50, lv: 1 }, straw: { slot: 'hat', name: 'หมวกฟาง', e: '👒', cost: 80, lv: 2 },
  ears: { slot: 'hat', name: 'ที่คาดผมหูแมว', e: '🐱', cost: 120, lv: 5 }, crown: { slot: 'hat', name: 'มงกุฎใบไม้', e: '👑', cost: 300, lv: 10 },
  round: { slot: 'glasses', name: 'แว่นกลม', e: '👓', cost: 60, lv: 1 }, shades: { slot: 'glasses', name: 'แว่นกันแดด', e: '🕶️', cost: 90, lv: 3 },
  pack: { slot: 'back', name: 'เป้านักเรียน', e: '🎒', cost: 100, lv: 2 }, wings: { slot: 'back', name: 'ปีกใบไม้', e: '🍃', cost: 200, lv: 8 },
};
const ALL = { ...SEEDS, ...DECOR, ...WEAR }, SLOTS = ['hat', 'glasses', 'back'], EXP_CAP = 60; // เพดาน EXP จากสวนต่อวัน กันปั๊มเลเวล

export const giveItem = (d, uid, item, qty = 1) =>
  d.run('INSERT INTO inventory (user_id,item,qty) VALUES (?,?,?) ON DUPLICATE KEY UPDATE qty=qty+?', [uid, item, qty, qty]);
const take = async (d, uid, item) => (await d.run('UPDATE inventory SET qty=qty-1 WHERE user_id=? AND item=? AND qty>0', [uid, item])).affectedRows === 1;

export async function registerGame({ app, db, student, h, award, thaiDay, nowUtc }) {
  for (const sql of [
    'CREATE TABLE IF NOT EXISTS inventory (user_id BIGINT NOT NULL, item VARCHAR(40) NOT NULL, qty BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (user_id,item))',
    'CREATE TABLE IF NOT EXISTS garden_plots (user_id BIGINT NOT NULL, slot INT NOT NULL, kind VARCHAR(10) NOT NULL, item VARCHAR(40) NOT NULL, planted_at VARCHAR(64), PRIMARY KEY (user_id,slot))',
    'CREATE TABLE IF NOT EXISTS equipment (user_id BIGINT NOT NULL, slot VARCHAR(10) NOT NULL, item VARCHAR(40) NOT NULL, PRIMARY KEY (user_id,slot))',
    'CREATE TABLE IF NOT EXISTS garden_harvests (id BIGINT NOT NULL AUTO_INCREMENT, user_id BIGINT NOT NULL, day VARCHAR(10) NOT NULL, exp BIGINT NOT NULL, PRIMARY KEY (id), KEY idx_gh (user_id,day))',
  ]) await db.run(sql + ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

  const lv = u => Math.floor(Math.sqrt(u.exp / 30)) + 1, unlocked = u => Math.min(16, 4 + (lv(u) - 1) * 2);
  const prog = p => Math.min(1, (Date.now() - Date.parse(p.planted_at.replace(' ', 'T') + 'Z')) / (SEEDS[p.item].min * 60e3));
  const lock = (d, uid) => d.get('SELECT * FROM users WHERE id=? FOR UPDATE', [uid]);
  const bad = (res, m, s = 400) => res.status(s).json({ error: m });
  const slotOf = (req, u) => { const s = Number(req.body?.slot); return Number.isInteger(s) && s >= 0 && s < unlocked(u) ? s : -1; };
  const done = (res, r) => typeof r === 'string' ? bad(res, r) : res.json(r || { ok: true });

  app.get('/api/bag', student, h(async (req, res) => {
    const inv = {}; for (const r of await db.all('SELECT item,qty FROM inventory WHERE user_id=? AND qty>0', [req.user.id])) inv[r.item] = Number(r.qty);
    const equip = {}; for (const r of await db.all('SELECT slot,item FROM equipment WHERE user_id=?', [req.user.id])) equip[r.slot] = r.item;
    res.json({ inv, equip, coins: Number(req.user.coins), level: lv(req.user), catalog: { seeds: SEEDS, decor: DECOR, wear: WEAR } });
  }));

  app.get('/api/garden', student, h(async (req, res) => {
    const rows = await db.all('SELECT slot,kind,item,planted_at FROM garden_plots WHERE user_id=?', [req.user.id]);
    const used = Number((await db.get('SELECT COALESCE(SUM(exp),0) s FROM garden_harvests WHERE user_id=? AND day=?', [req.user.id, thaiDay(0)])).s);
    res.json({ unlocked: unlocked(req.user), expToday: used, cap: EXP_CAP, plots: rows.map(p => {
      if (p.kind !== 'plant') return { slot: p.slot, kind: p.kind, item: p.item };
      const g = prog(p); return { slot: p.slot, kind: 'plant', item: p.item, progress: g, ready: g >= 1, left: Math.ceil((1 - g) * SEEDS[p.item].min) };
    }) });
  }));

  app.post('/api/shop/buy', student, h(async (req, res) => {
    const item = req.body?.item, c = ALL[item]; if (!c) return bad(res, 'ไม่พบสินค้า');
    done(res, await db.tx(async d => {
      const u = await lock(d, req.user.id);
      if (WEAR[item]) {
        if (lv(u) < c.lv) return `ต้องเลเวล ${c.lv} ขึ้นไป`;
        if ((await d.get('SELECT qty FROM inventory WHERE user_id=? AND item=? AND qty>0', [u.id, item]))) return 'มีชิ้นนี้อยู่แล้ว';
      }
      if (Number(u.coins) < c.cost) return 'เหรียญไม่พอ';
      await d.run('UPDATE users SET coins=coins-? WHERE id=?', [c.cost, u.id]); await giveItem(d, u.id, item, 1);
    }));
  }));

  app.post('/api/wardrobe/equip', student, h(async (req, res) => {
    const { slot, item } = req.body || {}; if (!SLOTS.includes(slot)) return bad(res, 'ข้อมูลไม่ถูกต้อง');
    if (item == null) { await db.run('DELETE FROM equipment WHERE user_id=? AND slot=?', [req.user.id, slot]); return res.json({ ok: true }); }
    if (!WEAR[item] || WEAR[item].slot !== slot) return bad(res, 'ข้อมูลไม่ถูกต้อง');
    if (!(await db.get('SELECT qty FROM inventory WHERE user_id=? AND item=? AND qty>0', [req.user.id, item]))) return bad(res, 'ยังไม่มีชิ้นนี้');
    await db.run('REPLACE INTO equipment (user_id,slot,item) VALUES (?,?,?)', [req.user.id, slot, item]); res.json({ ok: true });
  }));

  const emptyPlot = async (d, uid, s) => !(await d.get('SELECT slot FROM garden_plots WHERE user_id=? AND slot=?', [uid, s]));
  app.post('/api/garden/plant', student, h(async (req, res) => {
    const s = slotOf(req, req.user), seed = req.body?.seed; if (s < 0 || !SEEDS[seed]) return bad(res, 'ข้อมูลไม่ถูกต้อง');
    done(res, await db.tx(async d => {
      await lock(d, req.user.id);
      if (!(await emptyPlot(d, req.user.id, s))) return 'แปลงนี้ไม่ว่าง';
      if (!(await take(d, req.user.id, seed))) return 'ไม่มีเมล็ดนี้ในกระเป๋า';
      await d.run('INSERT INTO garden_plots (user_id,slot,kind,item,planted_at) VALUES (?,?,?,?,?)', [req.user.id, s, 'plant', seed, nowUtc()]);
    }));
  }));
  app.post('/api/garden/place', student, h(async (req, res) => {
    const s = slotOf(req, req.user), it = req.body?.decor; if (s < 0 || !DECOR[it]) return bad(res, 'ข้อมูลไม่ถูกต้อง');
    done(res, await db.tx(async d => {
      await lock(d, req.user.id);
      if (!(await emptyPlot(d, req.user.id, s))) return 'แปลงนี้ไม่ว่าง';
      if (!(await take(d, req.user.id, it))) return 'ไม่มีของชิ้นนี้ในกระเป๋า';
      await d.run('INSERT INTO garden_plots (user_id,slot,kind,item) VALUES (?,?,?,?)', [req.user.id, s, 'decor', it]);
    }));
  }));
  app.post('/api/garden/clear', student, h(async (req, res) => { // ของตกแต่ง = คืนเข้ากระเป๋า, ต้นไม้ = ถอนทิ้ง (ไม่คืนเมล็ด)
    const s = slotOf(req, req.user); if (s < 0) return bad(res, 'ข้อมูลไม่ถูกต้อง');
    done(res, await db.tx(async d => {
      await lock(d, req.user.id);
      const p = await d.get('SELECT * FROM garden_plots WHERE user_id=? AND slot=?', [req.user.id, s]); if (!p) return 'แปลงนี้ว่างอยู่';
      await d.run('DELETE FROM garden_plots WHERE user_id=? AND slot=?', [req.user.id, s]);
      if (p.kind === 'decor') await giveItem(d, req.user.id, p.item, 1);
    }));
  }));
  app.post('/api/garden/harvest', student, h(async (req, res) => {
    const s = slotOf(req, req.user); if (s < 0) return bad(res, 'ข้อมูลไม่ถูกต้อง');
    done(res, await db.tx(async d => {
      await lock(d, req.user.id);
      const p = await d.get('SELECT * FROM garden_plots WHERE user_id=? AND slot=?', [req.user.id, s]);
      if (!p || p.kind !== 'plant') return 'ไม่มีพืชในแปลงนี้';
      if (prog(p) < 1) return 'ยังไม่โตเต็มที่';
      const c = SEEDS[p.item], used = Number((await d.get('SELECT COALESCE(SUM(exp),0) s FROM garden_harvests WHERE user_id=? AND day=?', [req.user.id, thaiDay(0)])).s);
      const exp = Math.max(0, Math.min(c.exp, EXP_CAP - used));
      await d.run('DELETE FROM garden_plots WHERE user_id=? AND slot=?', [req.user.id, s]);
      await d.run('INSERT INTO garden_harvests (user_id,day,exp) VALUES (?,?,?)', [req.user.id, thaiDay(0), exp]);
      await award(d, req.user.id, 0, c.coins, exp);
      return { coins: c.coins, exp };
    }));
  }));
}