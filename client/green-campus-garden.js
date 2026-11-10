/* Green Campus — สวน กระเป๋า ตู้เสื้อผ้า แผนที่เต็ม ตัวละครสไตล์อนิเมะ (วางเป็นสคริปต์สุดท้ายต่อจาก green-campus-quests.js) */
(() => {
  const T = THREE, mat = c => new T.MeshLambertMaterial({ color: c }), GC = { x: -15, z: 9 }, PS = 2.5;
  let B = null, G = null, WP = null, lastSync = 0, back = () => { };
  const jp = (p, b) => api(p, { method: 'POST', body: b || {} }), mn = m => m >= 60 ? Math.round(m / 60) + ' ชม.' : m + ' นาที';
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `
  .tabs{display:flex;gap:6px;margin:8px 0}.tabs button{flex:1}
  .gg{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}
  .gs{aspect-ratio:1;font-size:1.7rem;padding:0;border-radius:14px;background:linear-gradient(180deg,#a47148,#7a5236);box-shadow:0 3px 0 #5a3b24}
  .gs.lk{background:#cfe6d4;box-shadow:0 3px 0 #b3cfba;opacity:.8}.gs.sel{outline:3px solid var(--sun)}.gs.rdy{animation:gcpulse 1s infinite}
  .det{background:#fff;border:2px solid #e0f1e6;border-radius:16px;padding:10px 12px;margin:8px 0}.det button{margin:3px 3px 3px 0}
  ` }));

  /* ---------- ตัวละครสไตล์อนิเมะ (หัวโต ตาโต แก้มแดง) ---------- */
  const U = player.userData, ch = player.children, rad = (c, r) => c.geometry && c.geometry.parameters && c.geometry.parameters.radius === r;
  const head = ch.find(c => rad(c, .55)); head.scale.setScalar(1.25); head.position.y = 2.45; U.hair.scale.setScalar(1.25); U.hair.position.y = 2.52;
  ch.filter(c => rad(c, .14)).forEach(c => { c.position.set(c.position.x * 1.25, 2.86, c.position.z); });
  const eyes = ch.filter(c => rad(c, .07)), wm = new T.MeshBasicMaterial({ color: 0xffffff }), pk = mat(0xffa3b5);
  eyes.forEach(e => { const s = Math.sign(e.position.x); e.position.set(s * .27, 2.47, .64); e.scale.set(1.8, 2.5, 1);
    const w = new T.Mesh(new T.SphereGeometry(.035, 6, 5), wm); w.position.set(s * .27 + .03, 2.53, .7); player.add(w);
    const b = new T.Mesh(new T.SphereGeometry(.1, 8, 6), pk); b.scale.set(1.4, .7, .3); b.position.set(s * .46, 2.3, .5); player.add(b); });
  const ahoge = new T.Mesh(new T.ConeGeometry(.06, .4, 6), U.hair.material); ahoge.position.set(0, 3.4, .1); ahoge.rotation.z = -.4; player.add(ahoge);

  /* ---------- ของสวมใส่ ---------- */
  let wearG = null, wings = null;
  const mesh = (g, c, x, y, z) => { const m = new T.Mesh(g, mat(c)); m.position.set(x, y, z); m.castShadow = true; return m; };
  function applyWear() {
    if (wearG) player.remove(wearG); wearG = new T.Group(); player.add(wearG); wings = null; const e = (B && B.equip) || {};
    const add = (...m) => wearG.add(...m);
    if (e.hat === 'cap') { add(mesh(new T.SphereGeometry(.74, 16, 8, 0, 6.283, 0, 1.57), 0x2f9e5b, 0, 2.95, 0), mesh(new T.BoxGeometry(.9, .05, .5), 0x207a44, 0, 2.97, .78)); }
    if (e.hat === 'straw') { add(mesh(new T.CylinderGeometry(1.1, 1.1, .06, 20), 0xe8cf8a, 0, 3.0, 0), mesh(new T.SphereGeometry(.62, 14, 8, 0, 6.283, 0, 1.57), 0xe8cf8a, 0, 3.0, 0)); }
    if (e.hat === 'ears') [-1, 1].forEach(s => { const m = mesh(new T.ConeGeometry(.2, .45, 6), 0xff9ab8, s * .42, 3.4, 0); m.rotation.z = -s * .25; add(m); });
    if (e.hat === 'crown') for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, m = mesh(new T.ConeGeometry(.12, .4, 5), i % 2 ? 0xffc83d : 0x57c274, Math.cos(a) * .6, 3.25, Math.sin(a) * .6); add(m); }
    if (e.glasses) [-1, 1].forEach(s => { const m = e.glasses === 'round' ? mesh(new T.TorusGeometry(.17, .03, 6, 14), 0x333344, s * .27, 2.47, .73) : mesh(new T.CylinderGeometry(.19, .19, .04, 12), 0x111118, s * .27, 2.47, .74); if (e.glasses === 'shades') m.rotation.x = 1.57; add(m); });
    if (e.glasses) add(mesh(new T.BoxGeometry(.2, .03, .03), 0x333344, 0, 2.5, .74));
    if (e.back === 'pack') add(mesh(new T.BoxGeometry(.75, .95, .3), 0xe8554a, 0, 1.45, -.85));
    if (e.back === 'wings') { wings = [-1, 1].map(s => { const m = mesh(new T.SphereGeometry(.5, 10, 8), 0x7ee08a, s * .6, 1.9, -.65); m.scale.set(.2, 1.1, .5); m.rotation.z = s * .5; m.userData.s = s; add(m); return m; }); }
  }

  /* ---------- สวน 3D ---------- */
  const slotXZ = s => [GC.x + (s % 4 - 1.5) * PS, GC.z + (Math.floor(s / 4) - 1.5) * PS];
  const GG = new T.Group(); scene.add(GG);
  const tiles = [], cont = [];
  for (let s = 0; s < 16; s++) {
    const [x, z] = slotXZ(s), t = mesh(new T.BoxGeometry(2.2, .12, 2.2), 0xb9e3c1, x, .06, z); t.receiveShadow = true; GG.add(t); tiles.push(t);
    const c = new T.Group(); c.position.set(x, .12, z); GG.add(c); cont.push(c);
  }
  // เอาต้นไม้สุ่มออกจากพื้นที่สวน
  for (let i = COLL.length - 1; i >= 0; i--) { const c = COLL[i]; if (c.r === .5 && Math.abs(c.x - GC.x) < 8 && Math.abs(c.z - GC.z) < 8) COLL.splice(i, 1); }
  scene.children.forEach(o => { if (o.isMesh && o.geometry && Math.abs(o.position.x - GC.x) < 8 && Math.abs(o.position.z - GC.z) < 8) {
    const p = o.geometry.parameters || {}; if ((o.geometry.type === 'BoxGeometry' && p.width === .5 && p.height === 2) || (o.geometry.type === 'SphereGeometry' && p.radius === 1 && o.position.y > 3)) o.visible = false; } });
  ZONES.push(['สวนของฉัน', GC.x, GC.z, 0x7ed67a, [10, .2, 10]]);
  const spot = { name: 'สวนของฉัน (ปลูกและตกแต่ง)', x: GC.x + 6.8, z: GC.z, act: () => showGarden() };
  spot.ring = new T.Mesh(new T.TorusGeometry(1.6, .12, 8, 24), new T.MeshBasicMaterial({ color: 0xffc83d })); spot.ring.rotation.x = Math.PI / 2; spot.ring.position.set(spot.x, .15, spot.z); scene.add(spot.ring); SPOTS.push(spot);
  document.fonts.ready.then(() => label('สวนของฉัน', GC.x, 3.2, GC.z, 6));

  const PET = [0xff8fb1, 0xffd84d, 0xc79bff, 0xff7a6b, 0xffffff];
  function build(p, s) {
    const g = cont[s]; while (g.children.length) g.remove(g.children[0]); g.userData.ready = false; g.scale.setScalar(1); if (!p) return;
    const m = (geo, c, x, y, z) => { const k = mesh(geo, c, x, y, z); g.add(k); return k; };
    if (p.kind === 'decor') {
      if (p.item === 'd_fence') { [-.9, 0, .9].forEach(x => m(new T.BoxGeometry(.12, .8, .12), 0xb98a5a, x, .4, .8)); m(new T.BoxGeometry(2, .1, .08), 0xb98a5a, 0, .55, .8); m(new T.BoxGeometry(2, .1, .08), 0xb98a5a, 0, .25, .8); }
      if (p.item === 'd_bench') { m(new T.BoxGeometry(1.5, .12, .5), 0x9a6a3a, 0, .5, 0); m(new T.BoxGeometry(1.5, .5, .1), 0x9a6a3a, 0, .8, -.25); [-.6, .6].forEach(x => m(new T.BoxGeometry(.1, .5, .4), 0x5a3b24, x, .25, 0)); }
      if (p.item === 'd_lamp') { m(new T.CylinderGeometry(.06, .08, 2, 8), 0x2d3b38, 0, 1, 0); m(new T.SphereGeometry(.28, 10, 8), 0xfff2b0, 0, 2.1, 0); }
      if (p.item === 'd_pond') { m(new T.CylinderGeometry(.95, .95, .1, 20), 0x6cc8ec, 0, .06, 0); for (let i = 0; i < 7; i++) m(new T.SphereGeometry(.16, 6, 5), 0xb9b4a6, Math.cos(i) * 1.0, .1, Math.sin(i) * 1.0); }
      return;
    }
    const q = p.progress;
    if (q < .34) { m(new T.SphereGeometry(.2, 8, 6), 0x57c274, 0, .2, 0); return; }
    if (!p.ready) { m(new T.CylinderGeometry(.04, .05, .6, 6), 0x3fae5f, 0, .3, 0); [-1, 1].forEach(x => { const l = m(new T.SphereGeometry(.2, 8, 6), 0x57c274, x * .2, .55, 0); l.scale.set(1, .4, .6); }); return; }
    g.userData.ready = true;
    if (p.item === 'seed_flower') { m(new T.CylinderGeometry(.04, .05, .7, 6), 0x3fae5f, 0, .35, 0); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; m(new T.SphereGeometry(.17, 8, 6), PET[s % 4], Math.cos(a) * .22, .85, Math.sin(a) * .22); } m(new T.SphereGeometry(.12, 8, 6), 0xffc83d, 0, .88, 0); }
    else if (p.item === 'seed_veg') { m(new T.SphereGeometry(.5, 12, 8), 0x7ed67a, 0, .45, 0); m(new T.SphereGeometry(.34, 10, 8), 0xb9f0a8, 0, .55, 0); }
    else { m(new T.CylinderGeometry(.14, .18, 1.3, 8), 0x7a5236, 0, .65, 0); m(new T.SphereGeometry(.85, 10, 8), 0x3fae5f, 0, 1.7, 0); m(new T.SphereGeometry(.6, 10, 8), 0x57c274, .4, 2.1, .2); if (s % 3 === 0) m(new T.SphereGeometry(.12, 6, 5), 0xff7a6b, -.5, 1.7, .6); }
  }
  function sync3D() {
    if (!G) return;
    for (let s = 0; s < 16; s++) { tiles[s].material.color.set(s < G.unlocked ? 0x7a5236 : 0xb9e3c1); build(G.plots.find(p => p.slot === s), s); }
  }
  async function loadAll() { [B, G] = await Promise.all([api('/bag'), api('/garden')]); applyWear(); sync3D(); }

  /* ---------- กระเป๋า / ตู้เสื้อผ้า ---------- */
  const SL = { hat: 'หมวก / ที่คาดผม', glasses: 'แว่นตา', back: 'ของสะพายหลัง' };
  const redo = async () => { await refresh(); await back(); };
  window.gcBuy = async k => { try { await jp('/shop/buy', { item: k }); toast('ซื้อแล้ว'); await redo(); } catch (e) { toast(e.message); } };
  window.gcEquip = async (slot, item) => { try { await jp('/wardrobe/equip', { slot, item }); await redo(); } catch (e) { toast(e.message); } };
  window.showBag = async function (tab = 'items') {
    try { await loadAll(); } catch (e) { return toast(e.message); } back = () => showBag(tab);
    const inv = B.inv, c = B.catalog, row = (e, n, q) => `<div class="row"><span>${e} ${esc(n)}</span><b>× ${q}</b></div>`;
    const head = `<div class="gshop"><h2>🎒 กระเป๋า</h2><span class="chip">🪙 ${B.coins}</span></div><div class="tabs"><button class="${tab === 'items' ? '' : 'alt'}" onclick="showBag('items')">ของในกระเป๋า</button><button class="${tab === 'wear' ? '' : 'alt'}" onclick="showBag('wear')">ตู้เสื้อผ้า</button></div>`;
    let body;
    if (tab === 'items') body = `<h3>🌱 เมล็ดพันธุ์</h3>${Object.entries(c.seeds).map(([k, v]) => row(v.e, v.name, inv[k] || 0)).join('')}<h3>🪑 ของตกแต่งสวน</h3>${Object.entries(c.decor).map(([k, v]) => row(v.e, v.name, inv[k] || 0)).join('')}
      <p class="sm">ซื้อเพิ่มได้ในเมนู “สวน” · ทำภารกิจ “ปลูกต้นไม้” จริงเพื่อรับต้นกล้าฟรี</p><button onclick="showGarden()">ไปที่สวน</button>`;
    else body = Object.keys(SL).map(sl => `<h3>${SL[sl]}</h3>` + Object.entries(c.wear).filter(([, v]) => v.slot === sl).map(([k, v]) => {
      const own = (inv[k] || 0) > 0, eq = B.equip[sl] === k;
      const btn = eq ? `<button class="alt" onclick="gcEquip('${sl}',null)">ถอด</button>` : own ? `<button onclick="gcEquip('${sl}','${k}')">ใส่</button>`
        : B.level < v.lv ? `<button disabled>🔒 Lv.${v.lv}</button>` : `<button ${B.coins < v.cost ? 'disabled' : ''} onclick="gcBuy('${k}')">ซื้อ 🪙${v.cost}</button>`;
      return `<div class="row"><span>${v.e} ${esc(v.name)}${eq ? ' <span class="tag">ใส่อยู่</span>' : ''}</span>${btn}</div>`; }).join('')).join('') + '<br><button class="alt" onclick="showProfile()">🎨 เปลี่ยนสีผม / ชุด</button>';
    openPanel(head + body);
  };

  /* ---------- สวน ---------- */
  window.gcDo = async (a, slot, item) => {
    try { const r = await jp('/garden/' + a, { slot, seed: item, decor: item });
      if (a === 'harvest') toast(`เก็บเกี่ยวแล้ว 🪙+${r.coins}${r.exp ? ' · EXP+' + r.exp : ' (EXP วันนี้เต็มแล้ว)'}`);
      await redo(); } catch (e) { toast(e.message); }
  };
  window.showGarden = async function (sel = null) {
    try { await loadAll(); } catch (e) { return toast(e.message); } back = () => showGarden(sel);
    const c = B.catalog, inv = B.inv, cells = Array.from({ length: 16 }, (_, s) => {
      const p = G.plots.find(x => x.slot === s); let em = '➕', cl = '';
      if (s >= G.unlocked) { em = '🔒'; cl = 'lk'; } else if (p) em = p.kind === 'decor' ? c.decor[p.item].e : p.ready ? c.seeds[p.item].e : p.progress < .34 ? '🌱' : '🌿';
      return `<button class="gs ${cl} ${sel === s ? 'sel' : ''} ${p && p.ready ? 'rdy' : ''}" onclick="showGarden(${s})">${em}</button>`; }).join('');
    let det = '<p class="sm">แตะแปลงเพื่อปลูก ตกแต่ง หรือเก็บเกี่ยว</p>';
    if (sel !== null) {
      const p = G.plots.find(x => x.slot === sel);
      if (sel >= G.unlocked) det = `<div class="det">🔒 แปลงนี้ปลดล็อกที่เลเวล ${Math.floor((sel - 4) / 2) + 2}</div>`;
      else if (!p) { const o = [...Object.entries(c.seeds).filter(([k]) => inv[k] > 0).map(([k, v]) => `<button onclick="gcDo('plant',${sel},'${k}')">ปลูก ${v.e} ${esc(v.name)} (${inv[k]})</button>`),
        ...Object.entries(c.decor).filter(([k]) => inv[k] > 0).map(([k, v]) => `<button class="alt" onclick="gcDo('place',${sel},'${k}')">วาง ${v.e} ${esc(v.name)} (${inv[k]})</button>`)];
        det = `<div class="det"><b>แปลงที่ ${sel + 1} (ว่าง)</b><br>${o.join('') || '<span class="sm">ยังไม่มีเมล็ดหรือของตกแต่ง ซื้อได้ด้านล่าง</span>'}</div>`; }
      else if (p.kind === 'decor') det = `<div class="det">${c.decor[p.item].e} ${esc(c.decor[p.item].name)}<br><button class="alt" onclick="gcDo('clear',${sel})">เก็บเข้ากระเป๋า</button></div>`;
      else if (p.ready) det = `<div class="det">${c.seeds[p.item].e} <b>${esc(c.seeds[p.item].name)}</b> โตเต็มที่แล้ว!<br><button onclick="gcDo('harvest',${sel})">🌾 เก็บเกี่ยว +🪙${c.seeds[p.item].coins}</button></div>`;
      else det = `<div class="det">${c.seeds[p.item].e} กำลังโต ${Math.round(p.progress * 100)}% · อีกประมาณ ${mn(p.left)}<br><button class="alt" onclick="if(confirm('ถอนต้นนี้ทิ้ง? จะไม่ได้เมล็ดคืน'))gcDo('clear',${sel})">ถอนทิ้ง</button></div>`;
    }
    const shop = [...Object.entries(c.seeds).map(([k, v]) => [k, v, `โต ${mn(v.min)} · ได้ 🪙${v.coins}`]), ...Object.entries(c.decor).map(([k, v]) => [k, v, 'ของตกแต่ง'])]
      .map(([k, v, d]) => `<div class="row"><span>${v.e} ${esc(v.name)}<div class="sm">${d} · มี ${inv[k] || 0}</div></span><button ${B.coins < v.cost ? 'disabled' : ''} onclick="gcBuy('${k}')">ซื้อ 🪙${v.cost}</button></div>`).join('');
    openPanel(`<div class="gshop"><h2>🌱 สวนของฉัน</h2><span class="chip">🪙 ${B.coins}</span></div><p class="sm">เลเวลสูงขึ้น ปลดล็อกแปลงเพิ่ม (${G.unlocked}/16) · EXP จากสวนวันนี้ ${G.expToday}/${G.cap}</p><div class="gg">${cells}</div>${det}<h3>🛒 ร้านเมล็ดพันธุ์และของตกแต่ง</h3>${shop}`);
  };

  /* ---------- แผนที่เต็ม + นำทาง ---------- */
  const beacon = new T.Mesh(new T.CylinderGeometry(.5, .5, 30, 12, 1, true), new T.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: .35, fog: false, side: T.DoubleSide })); beacon.visible = false; scene.add(beacon);
  window.gcGo = i => { WP = i < 0 ? null : { x: SPOTS[i].x, z: SPOTS[i].z }; beacon.visible = !!WP; if (WP) beacon.position.set(WP.x, 15, WP.z); closePanel(); toast(WP ? 'นำทางไป: ' + SPOTS[i].name : 'ยกเลิกเส้นทางแล้ว'); };
  window.showMap = function () {
    openPanel('<h2>🗺️ แผนที่</h2><canvas id="fm" width="360" height="360" style="width:100%;max-width:360px;display:block;margin:auto;border-radius:16px"></canvas><h3>นำทางไปที่…</h3>'
      + SPOTS.map((s, i) => `<div class="row"><span>${esc(s.name)}</span><button class="alt" onclick="gcGo(${i})">📍 นำทาง</button></div>`).join('') + (WP ? '<br><button onclick="gcGo(-1)">ยกเลิกเส้นทาง</button>' : ''));
    const g = $('#fm').getContext('2d'), S = 360, k = S / (WORLD * 2), X = x => S / 2 + x * k;
    g.fillStyle = '#9fd3a8'; g.fillRect(0, 0, S, S); g.fillStyle = '#e9e2cf'; g.fillRect(S / 2 - 12, 0, 24, S); g.fillRect(0, S / 2 - 12, S, 24);
    g.beginPath(); g.fillStyle = '#f0ead8'; g.arc(S / 2, S / 2, 9 * k, 0, 7); g.fill(); g.beginPath(); g.fillStyle = '#6cc8ec'; g.arc(S / 2, S / 2, 3.4 * k, 0, 7); g.fill();
    g.font = '600 11px Prompt,sans-serif'; g.textAlign = 'center';
    ZONES.forEach(z => { g.fillStyle = '#' + z[3].toString(16).padStart(6, '0'); g.fillRect(X(z[1]) - z[4][0] * k / 2, X(z[2]) - z[4][2] * k / 2, z[4][0] * k, z[4][2] * k); g.fillStyle = '#0f2a22'; g.fillText(z[0], X(z[1]), X(z[2]) + 4); });
    SPOTS.forEach(s => { g.fillStyle = s.npc ? '#e8554a' : '#0f2a22'; g.beginPath(); g.arc(X(s.x), X(s.z), 3, 0, 7); g.fill(); });
    if (WP) { g.fillStyle = '#ffc83d'; g.strokeStyle = '#0f2a22'; g.lineWidth = 2; g.beginPath(); g.arc(X(WP.x), X(WP.z), 7, 0, 7); g.fill(); g.stroke(); }
    g.save(); g.translate(X(player.position.x), X(player.position.z)); g.rotate(-player.rotation.y + Math.PI); g.fillStyle = '#e8554a'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 6); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
  };
  const dm = drawMini; drawMini = function () { dm(); if (WP) { const S = 132, k = S / (WORLD * 2); mini.fillStyle = '#ffc83d'; mini.beginPath(); mini.arc(S / 2 + WP.x * k, S / 2 + WP.z * k, 4 + Math.sin(performance.now() / 200) * 1.5, 0, 7); mini.fill(); } };

  /* ---------- เมนูล่างใหม่: กระเป๋า แผนที่ ภารกิจ สวน ร้านค้า เมนู ---------- */
  window.showMore = () => openPanel('<h2>☰ เมนู</h2>' + [['👤', 'โปรไฟล์และเหรียญตรา', 'showProfile()'], ['🥇', 'อันดับ', 'showRank()'], ['🎓', 'ใบประกาศ', 'showCerts()'], ['⚙️', 'ตั้งค่า', 'gcSettings()'], ['🚪', 'ออกจากระบบ', 'logout()']]
    .map(([e, n, f]) => `<div class="row"><span>${e} ${n}</span><button onclick="${f}">เปิด</button></div>`).join(''));
  const M = [['mag', '🎒', 'กระเป๋า', '#7fb2ff', '#4f86e0', () => showBag()], ['map', '🗺️', 'แผนที่', '#8fe0a0', '#3fae5f', () => showMap()], ['mis', '🏆', 'ภารกิจ', '#ffd75e', '#e9ae1c', () => showMissions()],
    ['gar', '🌱', 'สวน', '#b5e27a', '#6cbf3a', () => showGarden()], ['shp', '🏪', 'ร้านค้า', '#ff9a8a', '#e8554a', () => showShop()], ['more', '☰', 'เมนู', '#9db8c9', '#6a8aa0', () => showMore()]];
  $('#menu').innerHTML = '';
  M.forEach(([k, e, l, a, b, f]) => { const x = document.createElement('button'); x.dataset.k = k; x.innerHTML = `<span class="ic" style="background:linear-gradient(180deg,${a},${b})">${e}</span><small>${l}</small>`; x.onclick = f; $('#menu').appendChild(x); });

  /* ---------- ซิงก์ข้อมูล + อนิเมชัน ---------- */
  const rs0 = renderStat; renderStat = function () { rs0(); if (Date.now() - lastSync > 15000) { lastSync = Date.now(); loadAll().catch(() => { }); } };
  setInterval(() => { if (ME && !busy) loadAll().catch(() => { }); }, 60000);
  if (ME) loadAll().catch(() => { });
  window.gcLoad = async () => { await loadAll(); return { B, G }; }; // ให้ green-campus-garden-ui.js เรียกใช้
  (function tick() {
    requestAnimationFrame(tick); const t = performance.now() / 1000;
    cont.forEach(g => { if (g.userData.ready) g.scale.setScalar(1 + Math.sin(t * 4) * .06); });
    if (wings) wings.forEach(w => { w.rotation.z = w.userData.s * (.5 + Math.sin(t * 6) * .2 * (player.position.y > .001 ? 1.5 : .4)); });
    if (WP) { beacon.material.opacity = .25 + Math.sin(t * 3) * .1; if (Math.hypot(WP.x - player.position.x, WP.z - player.position.z) < 3.5) { WP = null; beacon.visible = false; toast('ถึงจุดหมายแล้ว 🎉'); } }
  })();
})();