/* Green Campus — UI Upgrade (Shop / เกมเรียนรู้ / ภารกิจ / HUD) วางหลัง green-campus-upgrade.js */
(() => {
  const oShop = showShop, oMis = showMissions;
  const ico = n => /กระเป๋า/.test(n) ? '👜' : /ตุ๊กตา|น้องใบไม้/.test(n) ? '🧸' : /ขวด|น้ำ/.test(n) ? '🍶' : /หมวก/.test(n) ? '🧢' : /สมุด/.test(n) ? '📓' : /เหรียญ|ตรา/.test(n) ? '🏅' : '🎁';
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `
  .gshop{display:flex;justify-content:space-between;align-items:center;margin-right:56px}
  .gshop h2{margin:0;font-size:1.6rem;color:#fff;background:linear-gradient(180deg,#52c97f,#2f9e5b);padding:.2em .8em;border-radius:14px;box-shadow:0 3px 0 #207a44;text-shadow:0 2px 0 rgba(0,0,0,.2)}
  .chip{background:#fff;border:2px solid #e0f1e6;border-radius:99px;padding:.2em .8em;font-weight:600}
  .sg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}
  .sc{background:#fff;border:2px solid #e0f1e6;border-radius:16px;padding:10px 6px;text-align:center;box-shadow:0 3px 0 #e0f1e6;display:flex;flex-direction:column;gap:4px;align-items:center}
  .si{font-size:2.6rem;line-height:1.2}.sc b{font-size:.9rem}.sc button{width:100%;padding:.35em}
  .mc{display:flex;gap:12px;align-items:center;background:#fff;border:2px solid #e0f1e6;border-radius:16px;padding:10px 12px;margin:8px 0;box-shadow:0 2px 0 #e0f1e6}
  .mi{font-size:2rem;background:var(--mint);border-radius:12px;width:56px;height:56px;display:grid;place-items:center;flex:none}.mb{flex:1}
  .gh{display:flex;justify-content:space-between;align-items:center;margin-right:56px;margin-bottom:12px}
  .gt{background:var(--ink);color:#fff;padding:.3em .9em;border-radius:99px;font-weight:600}
  .gtm{background:#fff;border:3px solid var(--sun);border-radius:99px;padding:.15em .8em;font-weight:600}
  .gq{display:flex;gap:12px;align-items:flex-start}
  .mas{font-size:2.8rem;background:#fff;border:3px solid var(--mint);border-radius:50%;width:84px;height:84px;display:grid;place-items:center;flex:none;animation:gcb 1.6s ease-in-out infinite}
  @keyframes gcb{50%{transform:translateY(-6px)}}
  .gb{flex:1;background:#fff;border-radius:16px;padding:12px;box-shadow:0 2px 0 #e0f1e6}.gqt{text-align:center;margin:.4em 0 .8em}
  #stat{display:flex;gap:10px;align-items:center}
  #stat .lv{width:44px;height:44px;border-radius:50%;background:linear-gradient(180deg,#ffd75e,#e9ae1c);border:3px solid #fff;display:grid;place-items:center;font-weight:600;box-shadow:0 2px 0 #b88410;flex:none}
  #stat .sb{flex:1}
  @media(max-width:480px){.sg{grid-template-columns:repeat(2,1fr)}.gq{flex-direction:column;align-items:center}}
  ` }));

  /* ---------- HUD ---------- */
  renderStat = function () {
    const u = ME.user, pct = Math.min(100, (u.exp - u.expThis) / (u.expNext - u.expThis) * 100);
    $('#stat').innerHTML = `<div class="lv">${u.level}</div><div class="sb"><b>${esc(u.name)}</b> <span class="sm">${esc(u.classroom)}</span>
    <div class="sm">${esc(u.title)} · ${u.exp}/${u.expNext}</div><div class="bar"><i style="width:${pct}%"></i></div>
    <div class="m"><span>🟢 ${u.points}</span><span>🪙 ${u.coins}</span></div></div>`;
  };

  /* ---------- Green Shop ---------- */
  showShop = async function () {
    const rs = await api('/rewards'), mine = await api('/redemptions/mine').catch(() => []);
    const RL = { pending: '🕒 รอรับของที่ครู', given: '✅ รับแล้ว', cancelled: '↩️ ยกเลิก (คืนคะแนนแล้ว)' };
    openPanel(`<div class="gshop"><h2>🛒 Green Shop</h2><span class="chip">🟢 ${ME.user.points}</span></div>
    <p class="sm">แลกของรางวัลสุดพิเศษด้วย Green Point</p>
    <div class="sg">${rs.map(r => `<div class="sc"><div class="si">${ico(r.name)}</div><b>${esc(r.name)}</b>
      <div class="sm">ใช้ ${r.cost} แต้ม · เหลือ ${r.stock}</div>
      <button ${r.stock < 1 || ME.user.points < r.cost ? 'disabled' : ''} onclick="redeem(${r.id})">แลก</button></div>`).join('')}</div>
    <h3>ประวัติการแลก</h3>${mine.map(d => `<div class="row"><span>${esc(d.name)}<div class="sm">${esc(d.created_at)} UTC</div></span><span class="sm">${RL[d.status] || d.status}</span></div>`).join('') || '<p class="sm">ยังไม่เคยแลก</p>'}`);
  };

  /* ---------- ภารกิจ ---------- */
  showMissions = async function () {
    const ms = await api('/missions'); window._ms = ms;
    const T = { daily: 'ประจำวัน', weekly: 'ประจำสัปดาห์', special: 'พิเศษ' }, I = { daily: '♻️', weekly: '📅', special: '⭐' };
    openPanel('<h2>📋 ภารกิจ</h2>' + ms.map(m => `<div class="mc"><div class="mi">${I[m.type] || '🌱'}</div><div class="mb">
      <span class="tag ${m.type === 'special' ? 'sp' : ''}">${T[m.type]}</span><b>${esc(m.title)}</b><div class="sm">${esc(m.description)}</div>
      <div class="sm">+${m.points} Point · +${m.coins} Coin · +${m.exp} EXP${m.certificate ? ' · 🎓' : ''} · ทำแล้ว ${m.used}/${m.limit}</div></div>
      <button ${m.used >= m.limit ? 'disabled' : ''} onclick="startSubmit(${m.id})">ส่งหลักฐาน</button></div>`).join(''));
  };

  /* ---------- เกมการเรียนรู้ (มาสคอต + จับเวลา 30 วินาที/ข้อ) ---------- */
  let gcT; const fmt = s => '00:' + String(s).padStart(2, '0');
  function clock(onEnd) {
    clearInterval(gcT); let s = 30;
    gcT = setInterval(() => { const e = $('#gct'); if (!e) return clearInterval(gcT); s--; e.textContent = '⏱ ' + fmt(s); if (s <= 0) { clearInterval(gcT); onEnd(); } }, 1000);
  }
  const shell = (title, body) => openPanel(`<div class="gh"><span class="gt">🎮 ${title}</span><span class="gtm" id="gct">⏱ 00:30</span></div><div class="gq"><div class="mas">🍃</div><div class="gb">${body}</div></div>`);

  sortGame = function (L) {
    const items = [...L.items].sort(() => Math.random() - .5), picks = {}, ks = Object.keys(BINS); let i = 0;
    window._pick = b => { picks[items[i].n] = b; i++; step(); };
    const step = () => {
      if (i >= items.length) { clearInterval(gcT); return quiz(L, picks); }
      shell(`แยกขยะ ${i + 1}/${items.length}`, `<div style="font-size:2.6rem;text-align:center">${items[i].e}</div>
      <p class="gqt"><b>การคัดแยกขยะ: ${esc(items[i].n)} ควรทิ้งในถังใด ?</b></p>
      <div class="grid">${Object.entries(BINS).map(([k, [n, c]]) => `<button class="bin" style="background:${c}" onclick="_pick('${k}')">${n}</button>`).join('')}</div>`);
      clock(() => _pick(ks[Math.floor(Math.random() * ks.length)]));
    };
    step();
  };

  quiz = function (L, picks) {
    const answers = []; let q = 0; window._ans = a => { answers.push(a); q++; step(); };
    const step = async () => {
      if (q >= L.quiz.length) {
        clearInterval(gcT);
        try {
          const r = await api(`/lesson/${L.key}/submit`, { method: 'POST', body: { sort: picks, quiz: answers } });
          openPanel(`<h2>🎉 สรุปผล</h2><p>แยกขยะถูก ${r.sortRight}/${r.sortTotal} · Quiz ถูก ${r.quizRight}/${r.quizTotal}</p><p class="ok">+${r.points} Point · +${r.coins} Coin · +${r.exp} EXP</p>
          ${r.capped ? '<p class="sm">ถึงเพดานคะแนนเกมของวันนี้แล้ว ลองทำกิจกรรมจริงเพื่อรับคะแนนมากกว่า</p>' : ''}<button onclick="closePanel()">ปิด</button>`);
        } catch (e) { toast(e.message); closePanel(); } return;
      }
      const Q = L.quiz[q];
      shell(`ทดสอบความรู้ ${q + 1}/${L.quiz.length}`, `<p class="gqt"><b>${esc(Q.q)}</b></p><div class="grid">${Q.c.map((c, k) => `<button class="alt" onclick="_ans(${k})">${esc(c)}</button>`).join('')}</div>`);
      clock(() => _ans(Math.floor(Math.random() * Q.c.length)));
    };
    step();
  };

  /* ---------- ผูกปุ่มเมนู/จุดในแผนที่/NPC ให้ใช้ฟังก์ชันใหม่ ---------- */
  const mb = document.querySelectorAll('#menu button');
  mb[0].onclick = () => showMissions(); mb[2].onclick = () => showShop();
  SPOTS.forEach(s => { if (s.act === oShop) s.act = () => showShop(); else if (s.act === oMis) s.act = () => showMissions(); });
  Object.values(NPC_TALK).forEach(n => { if (n[2] === oMis) n[2] = () => showMissions(); });
  if (ME) renderStat();
})();