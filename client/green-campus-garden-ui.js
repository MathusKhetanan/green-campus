/* Green Campus — หน้าสวนแบบจริงจัง (วางเป็นสคริปต์สุดท้าย ต่อจาก green-campus-garden.js)
   ฟีเจอร์: แปลงสวนแบบการ์ด + แถบความโตนับถอยหลังสด ๆ · แตะแปลงที่สุกเพื่อเก็บเกี่ยวทันที
   · เลือกเมล็ด/ของตกแต่งแล้วแตะแปลงว่างเพื่อปลูก · เก็บเกี่ยวทั้งหมด · แท็บร้านค้า/กระเป๋า · นำทางไปสวน */
(() => {
  const jp = (p, b) => api(p, { method: 'POST', body: b || {} });
  const mn = m => m >= 1440 ? Math.round(m / 1440) + ' วัน' : m >= 60 ? Math.round(m / 60) + ' ชม.' : Math.max(1, m) + ' นาที';
  const clk = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const lvOf = s => Math.floor((s - 4) / 2) + 2;
  let B = null, G = null, at = 0, sel = null, tool = null, tab = 'plot', timer = null, working = false;

  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `
  .gz{--soil:#8a5a36;--soil2:#6b4226}
  .gz .top{display:flex;justify-content:space-between;align-items:center;margin-right:56px;gap:8px;flex-wrap:wrap}
  .gz .top h2{margin:0;font-size:1.5rem;color:#fff;background:linear-gradient(180deg,#52c97f,#2f9e5b);padding:.2em .8em;border-radius:14px;box-shadow:0 3px 0 #207a44}
  .gz .chips{display:flex;gap:6px;flex-wrap:wrap}
  .gz .exp{margin:10px 0 4px}.gz .exp .bar{margin:4px 0}
  .gz .tabs{display:flex;gap:6px;margin:10px 0}.gz .tabs button{flex:1;padding:.5em .3em;font-size:.9rem}
  .gz .tools{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch}
  .gz .tl{flex:none;min-width:64px;display:flex;flex-direction:column;align-items:center;gap:0;padding:6px 8px;border-radius:14px;background:#fff;color:var(--ink);border:2px solid #e0f1e6;box-shadow:0 3px 0 #e0f1e6;font-size:.72rem;line-height:1.2}
  .gz .tl b{font-size:1.5rem;font-weight:400}
  .gz .tl.on{border-color:var(--sun);background:#fff8dc;box-shadow:0 3px 0 #e9ae1c;transform:translateY(-2px)}
  .gz .tl.dis{opacity:.45}
  .gz .field{background:linear-gradient(180deg,#9be0a8,#7ccf8e);border:3px solid #fff;border-radius:22px;padding:12px;box-shadow:inset 0 0 0 3px rgba(47,158,91,.25),0 4px 0 #b5dcc3}
  .gz .pg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .gz .p{position:relative;aspect-ratio:1;padding:0;border-radius:16px;overflow:hidden;color:var(--ink);background:radial-gradient(circle at 50% 35%,var(--soil),var(--soil2));box-shadow:inset 0 3px 6px rgba(0,0,0,.35),0 3px 0 #4a2e1a;display:flex;align-items:center;justify-content:center;font-size:2rem;transition:transform .12s}
  .gz .p:active{transform:scale(.94)}
  .gz .p::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 9px,rgba(0,0,0,.1) 9px 11px);pointer-events:none}
  .gz .p>span{position:relative;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}
  .gz .p.empty{background:radial-gradient(circle at 50% 35%,#a8744b,#80552f);color:rgba(255,255,255,.7)}
  .gz .p.empty.hot{outline:3px dashed #fff;outline-offset:-5px;animation:gcpulse 1s infinite}
  .gz .p.lk{background:linear-gradient(180deg,#cfe6d4,#b7d4be);box-shadow:inset 0 2px 4px rgba(0,0,0,.1),0 3px 0 #98bba3;color:#4b6b57;flex-direction:column;font-size:1.3rem;gap:0}
  .gz .p.lk small{font-size:.68rem;font-weight:600}
  .gz .p.decor{background:radial-gradient(circle at 50% 35%,#b9e3c1,#8fcf9d);box-shadow:inset 0 2px 4px rgba(0,0,0,.12),0 3px 0 #6fb07e}
  .gz .p.decor::before{display:none}
  .gz .p.rdy{animation:gcpulse 1s infinite;box-shadow:inset 0 3px 6px rgba(0,0,0,.35),0 0 0 3px var(--sun),0 0 16px 4px rgba(255,200,61,.8)}
  .gz .p.sel{outline:3px solid #fff;outline-offset:1px}
  .gz .p .pb{position:absolute;left:8%;right:8%;bottom:6%;height:7px;border-radius:5px;background:rgba(0,0,0,.4);overflow:hidden}
  .gz .p .pb i{display:block;height:100%;background:linear-gradient(90deg,#8be39a,#ffd75e);transition:width 1s linear}
  .gz .p .tm{position:absolute;top:4px;left:0;right:0;font-size:.62rem;font-weight:600;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8)}
  .gz .p .bdg{position:absolute;top:3px;right:3px;font-size:.9rem;animation:gcb 1s ease-in-out infinite}
  .gz .info{margin-top:10px;background:#fff;border:2px solid #e0f1e6;border-radius:16px;padding:10px 12px;box-shadow:0 2px 0 #e0f1e6;min-height:64px}
  .gz .info .bt{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.gz .info .bt button{flex:1;min-width:110px}
  .gz .info .ln{display:flex;align-items:center;gap:10px}.gz .info .big{font-size:2.4rem;line-height:1}
  .gz .info .bar{margin:6px 0 2px}
  .gz .acts{display:flex;gap:8px;margin-top:10px}.gz .acts button{flex:1}
  .gz .it{display:flex;gap:10px;align-items:center;background:#fff;border:2px solid #e0f1e6;border-radius:16px;padding:10px 12px;margin:8px 0;box-shadow:0 2px 0 #e0f1e6}
  .gz .it .em{font-size:2.2rem;width:52px;height:52px;border-radius:14px;background:var(--mint);display:grid;place-items:center;flex:none}
  .gz .it .tx{flex:1;min-width:0}.gz .it .tx b{display:block}
  .gz .st{display:flex;gap:6px;flex-wrap:wrap;margin-top:3px}
  .gz .st span{font-size:.72rem;background:var(--mint);border-radius:99px;padding:.1em .6em}
  .gz .gain{position:fixed;left:50%;top:38%;transform:translate(-50%,0);z-index:40;font-weight:600;font-size:1.5rem;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6);pointer-events:none;animation:gzup 1.3s ease-out forwards}
  @keyframes gzup{to{transform:translate(-50%,-70px);opacity:0}}
  @media(max-width:480px){.gz .p{font-size:1.7rem;border-radius:12px}.gz .pg{gap:6px}}
  ` }));

  async function load() { const r = await gcLoad(); B = r.B; G = r.G; at = Date.now(); }
  const panelOpen = () => !!$('#gz') && $('#veil').style.display !== 'none';
  const plotAt = s => G.plots.find(p => p.slot === s);
  const cat = () => B.catalog;
  // เวลาที่เหลือ "สด" คำนวณจากเวลาที่ดึงข้อมูลมา
  const leftSec = p => Math.max(0, p.left * 60 - (Date.now() - at) / 1000);
  const liveLeft = p => { const tot = cat().seeds[p.item].min * 60, rem = Math.max(0, (1 - p.progress) * tot - (Date.now() - at) / 1000); return rem; };
  const livePct = p => { const tot = cat().seeds[p.item].min * 60; return Math.min(1, 1 - liveLeft(p) / tot); };
  const isReady = p => p && p.kind === 'plant' && (p.ready || liveLeft(p) <= 0);
  const stage = p => { const q = livePct(p); return isReady(p) ? cat().seeds[p.item].e : q < .34 ? '🌱' : '🌿'; };

  function fx(t) { const e = document.createElement('div'); e.className = 'gain'; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 1400); }

  async function act(a, slot, item, quiet) {
    if (working) return null; working = true;
    try {
      const r = await jp('/garden/' + a, { slot, seed: item, decor: item });
      await refresh(); await load(); return r;
    } catch (e) { toast(e.message); try { await load(); } catch { } return null; }
    finally { working = false; }
  }

  /* ---------- วาดหน้าจอ ---------- */
  function invBtn(k, v, kind) {
    const n = B.inv[k] || 0, on = tool && tool.k === k;
    return `<button class="tl ${on ? 'on' : ''} ${n < 1 ? 'dis' : ''}" ${n < 1 ? 'disabled' : ''} onclick="gzTool('${k}','${kind}')"><b>${v.e}</b>${esc(v.name)}<span class="sm">× ${n}</span></button>`;
  }
  function cell(s) {
    const c = cat(); const sl = sel === s ? 'sel' : '';
    if (s >= G.unlocked) return `<button class="p lk ${sl}" onclick="gzTap(${s})">🔒<small>Lv.${lvOf(s)}</small></button>`;
    const p = plotAt(s);
    if (!p) return `<button class="p empty ${tool ? 'hot' : ''} ${sl}" onclick="gzTap(${s})"><span>${tool ? cat()[tool.kind === 'seed' ? 'seeds' : 'decor'][tool.k].e : '＋'}</span></button>`;
    if (p.kind === 'decor') return `<button class="p decor ${sl}" onclick="gzTap(${s})"><span>${c.decor[p.item].e}</span></button>`;
    const rd = isReady(p);
    return `<button class="p ${rd ? 'rdy' : ''} ${sl}" data-s="${s}" onclick="gzTap(${s})"><span>${stage(p)}</span>${rd ? '<i class="bdg">✨</i>' : `<i class="tm" data-t="${s}">${clk(liveLeft(p))}</i><div class="pb"><i data-b="${s}" style="width:${livePct(p) * 100}%"></i></div>`}</button>`;
  }
  function info() {
    const c = cat();
    if (sel === null) return '<div class="sm">แตะแปลงเพื่อดูรายละเอียด · แปลงที่มี ✨ แตะเพื่อเก็บเกี่ยวได้เลย · หรือเลือกเมล็ดจากแถบด้านบนแล้วแตะแปลงว่างเพื่อปลูก</div>';
    if (sel >= G.unlocked) return `<div class="ln"><span class="big">🔒</span><div><b>แปลงที่ ${sel + 1} ยังถูกล็อก</b><div class="sm">ปลดล็อกที่เลเวล ${lvOf(sel)} (ตอนนี้ Lv.${B.level}) · เก็บ EXP จากภารกิจและการเก็บเกี่ยว</div></div></div>`;
    const p = plotAt(sel);
    if (!p) {
      const o = [...Object.entries(c.seeds).filter(([k]) => B.inv[k] > 0).map(([k, v]) => `<button onclick="gzDo('plant',${sel},'${k}')">ปลูก ${v.e} ${esc(v.name)} (${B.inv[k]})</button>`),
      ...Object.entries(c.decor).filter(([k]) => B.inv[k] > 0).map(([k, v]) => `<button class="alt" onclick="gzDo('place',${sel},'${k}')">วาง ${v.e} ${esc(v.name)} (${B.inv[k]})</button>`)];
      return `<b>แปลงที่ ${sel + 1} · ว่าง</b><div class="bt">${o.join('') || '<span class="sm">ยังไม่มีเมล็ดหรือของตกแต่ง — ไปที่แท็บ “ร้านเมล็ด” ได้เลย</span>'}</div>`;
    }
    if (p.kind === 'decor') return `<div class="ln"><span class="big">${c.decor[p.item].e}</span><div><b>${esc(c.decor[p.item].name)}</b><div class="sm">ของตกแต่งสวน</div></div></div><div class="bt"><button class="alt" onclick="gzDo('clear',${sel})">เก็บเข้ากระเป๋า</button></div>`;
    const sd = c.seeds[p.item];
    if (isReady(p)) return `<div class="ln"><span class="big">${sd.e}</span><div><b>${esc(sd.name)} · โตเต็มที่แล้ว!</b><div class="sm">เก็บเกี่ยวได้ 🪙${sd.coins} · EXP +${sd.exp}</div></div></div><div class="bt"><button onclick="gzDo('harvest',${sel})">🌾 เก็บเกี่ยว</button></div>`;
    return `<div class="ln"><span class="big" data-ie>${stage(p)}</span><div style="flex:1"><b>${esc(sd.name)} · กำลังโต <span data-ip>${Math.round(livePct(p) * 100)}</span>%</b><div class="bar"><i data-ib style="width:${livePct(p) * 100}%"></i></div><div class="sm">อีก <b data-il>${clk(liveLeft(p))}</b> · ได้ 🪙${sd.coins}</div></div></div><div class="bt"><button class="alt" onclick="if(confirm('ถอนต้นนี้ทิ้ง? จะไม่ได้เมล็ดคืน'))gzDo('clear',${sel})">ถอนทิ้ง</button></div>`;
  }
  function plotTab() {
    const c = cat(), nR = G.plots.filter(isReady).length, ex = Math.min(100, G.expToday / G.cap * 100);
    const seeds = Object.entries(c.seeds).map(([k, v]) => invBtn(k, v, 'seed')).join(''), dec = Object.entries(c.decor).map(([k, v]) => invBtn(k, v, 'decor')).join('');
    return `<div class="exp sm">EXP จากสวนวันนี้ ${G.expToday}/${G.cap}<div class="bar"><i style="width:${ex}%"></i></div></div>
    <div class="tools">${seeds}${dec}</div>
    <div class="field"><div class="pg" id="gzgrid">${Array.from({ length: 16 }, (_, s) => cell(s)).join('')}</div></div>
    <div class="info" id="gzinfo">${info()}</div>
    <div class="acts"><button ${nR ? '' : 'disabled'} onclick="gzAll()">🌾 เก็บเกี่ยวทั้งหมด${nR ? ' (' + nR + ')' : ''}</button><button class="alt" onclick="gzNav()">📍 นำทางไปสวน</button></div>
    <p class="sm" style="margin-bottom:0">ปลดล็อกแปลงเพิ่มเมื่อเลเวลสูงขึ้น (${G.unlocked}/16) · ต้นกล้า 🌳 ได้ฟรีจากภารกิจ “ปลูกต้นไม้” จริง</p>`;
  }
  function shopTab() {
    const c = cat(), row = (k, v, d, kind) => `<div class="it"><div class="em">${v.e}</div><div class="tx"><b>${esc(v.name)}</b><div class="st">${d.map(x => `<span>${x}</span>`).join('')}<span>มี ${B.inv[k] || 0}</span></div></div><button ${B.coins < v.cost ? 'disabled' : ''} onclick="gzBuy('${k}')">🪙${v.cost}</button></div>`;
    return `<h3>🌱 เมล็ดพันธุ์</h3>${Object.entries(c.seeds).map(([k, v]) => row(k, v, [`โต ${mn(v.min)}`, `ได้ 🪙${v.coins}`, `EXP ${v.exp}`, `กำไร 🪙${v.coins - v.cost}`])).join('')}
    <h3>🪑 ของตกแต่งสวน</h3>${Object.entries(c.decor).map(([k, v]) => row(k, v, ['ตกแต่ง'])).join('')}`;
  }
  function render() {
    const root = $('#gz'); if (!root) return;
    const body = tab === 'plot' ? plotTab() : tab === 'shop' ? shopTab() : bagTab();
    root.innerHTML = `<div class="top"><h2>🌱 สวนของฉัน</h2><div class="chips"><span class="chip">Lv.${B.level}</span><span class="chip">🪙 ${B.coins}</span></div></div>
    <div class="tabs"><button class="${tab === 'plot' ? '' : 'alt'}" onclick="gzTab('plot')">🌾 แปลงสวน</button><button class="${tab === 'shop' ? '' : 'alt'}" onclick="gzTab('shop')">🛒 ร้านเมล็ด</button><button class="${tab === 'bag' ? '' : 'alt'}" onclick="gzTab('bag')">🎒 ของฉัน</button></div>${body}`;
  }
  function bagTab() {
    const c = cat(), r = (v, n) => `<div class="it"><div class="em">${v.e}</div><div class="tx"><b>${esc(v.name)}</b></div><b>× ${n}</b></div>`;
    return `<h3>🌱 เมล็ดพันธุ์</h3>${Object.entries(c.seeds).map(([k, v]) => r(v, B.inv[k] || 0)).join('')}<h3>🪑 ของตกแต่ง</h3>${Object.entries(c.decor).map(([k, v]) => r(v, B.inv[k] || 0)).join('')}<button class="alt" onclick="showBag('wear')">👕 ไปตู้เสื้อผ้า</button>`;
  }

  /* ---------- ตัวจับเวลา: อัปเดตเฉพาะตัวเลข ไม่สร้าง DOM ใหม่ (กดไม่พลาด) ---------- */
  function tick() {
    if (!panelOpen()) { clearInterval(timer); timer = null; return; }
    if (tab !== 'plot') return;
    let cross = false;
    G.plots.forEach(p => {
      if (p.kind !== 'plant' || p.ready) return;
      if (liveLeft(p) <= 0) { cross = true; return; }
      const t = document.querySelector(`[data-t="${p.slot}"]`), b = document.querySelector(`[data-b="${p.slot}"]`);
      if (t) t.textContent = clk(liveLeft(p)); if (b) b.style.width = livePct(p) * 100 + '%';
      if (sel === p.slot) {
        const q = s => document.querySelector(s), l = q('[data-il]'), ib = q('[data-ib]'), ip = q('[data-ip]'), ie = q('[data-ie]');
        if (l) l.textContent = clk(liveLeft(p)); if (ib) ib.style.width = livePct(p) * 100 + '%'; if (ip) ip.textContent = Math.round(livePct(p) * 100); if (ie) ie.textContent = stage(p);
      }
    });
    if (cross || Date.now() - at > 30000) load().then(() => { if (panelOpen() && !working) render(); }).catch(() => { });
  }

  /* ---------- การกระทำ ---------- */
  window.gzTab = t => { tab = t; render(); };
  window.gzTool = (k, kind) => { tool = tool && tool.k === k ? null : { k, kind }; sel = null; render(); };
  window.gzNav = () => { const i = SPOTS.findIndex(s => s.name.startsWith('สวนของฉัน')); if (i >= 0) gcGo(i); };
  window.gzBuy = async k => {
    if (working) return; working = true;
    try { await jp('/shop/buy', { item: k }); await refresh(); await load(); toast('ซื้อแล้ว'); } catch (e) { toast(e.message); }
    working = false; render();
  };
  window.gzDo = async (a, s, item) => {
    const p = plotAt(s), sd = p && p.kind === 'plant' ? cat().seeds[p.item] : null;
    const r = await act(a, s, item);
    if (r && a === 'harvest') { fx(`🪙 +${sd.coins}${r.exp ? '  ✨ EXP +' + r.exp : ''}`); if (!r.exp) toast('EXP จากสวนวันนี้เต็มแล้ว'); }
    if (r && a === 'plant') toast('ปลูกแล้ว 🌱 กลับมาเก็บเมื่อโตเต็มที่');
    if (tool && (B.inv[tool.k] || 0) < 1) tool = null;
    if (a !== 'clear' || true) sel = (a === 'plant' || a === 'place') ? s : (a === 'harvest' || a === 'clear' ? null : sel);
    render();
  };
  window.gzTap = async s => {
    if (working) return;
    if (s >= G.unlocked) { sel = s; return render(); }
    const p = plotAt(s);
    if (isReady(p)) return gzDo('harvest', s);                       // สุกแล้ว: แตะเก็บเลย
    if (!p && tool) return gzDo(tool.kind === 'seed' ? 'plant' : 'place', s, tool.k); // มีเครื่องมือ: แตะวาง
    sel = sel === s ? null : s; render();
  };
  window.gzAll = async () => {
    if (working) return; const rs = G.plots.filter(isReady).map(p => p.slot); if (!rs.length) return;
    let coins = 0, exp = 0, n = 0;
    for (const s of rs) {
      const p = plotAt(s), sd = cat().seeds[p.item];
      try { const r = await jp('/garden/harvest', { slot: s }); coins += sd.coins; exp += r.exp || 0; n++; } catch (e) { toast(e.message); break; }
    }
    try { await refresh(); await load(); } catch { }
    if (n) fx(`🌾 ×${n}  🪙 +${coins}${exp ? '  ✨ +' + exp : ''}`);
    sel = null; render();
  };

  window.showGarden = async function (s) {
    try { await load(); } catch (e) { return toast(e.message); }
    if (typeof s === 'number') { sel = s; tab = 'plot'; }
    openPanel('<div class="gz" id="gz"></div>'); render();
    clearInterval(timer); timer = setInterval(tick, 1000);
  };
})();