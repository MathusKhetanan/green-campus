/* Green Campus — ภารกิจประจำวัน หีบรางวัล สตรีค เป้าหมายห้อง (วางเป็นสคริปต์สุดท้ายใน index.html) */
(() => {
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `
  #quest .qbar{height:8px;background:#d9f2e1;border-radius:5px;margin:6px 0;overflow:hidden}
  #quest .qbar i,.qb i{display:block;height:100%;background:linear-gradient(90deg,#8be39a,#2f9e5b)}
  .qb{height:10px;background:#d9f2e1;border-radius:6px;margin:6px 0;overflow:hidden}
  .qf{margin-top:6px;font-weight:600}.qf.ready{color:#e8554a;animation:gcpulse 1s ease-in-out infinite}
  @keyframes gcpulse{50%{transform:scale(1.05)}}
  #menu .ic{position:relative}
  .dot{position:absolute;top:-5px;right:-5px;width:15px;height:15px;border-radius:50%;background:#e8554a;border:2px solid #fff}
  .gift{font-size:4.2rem;animation:gcshake .7s}
  @keyframes gcshake{20%{transform:rotate(-14deg)}40%{transform:rotate(14deg)}60%{transform:rotate(-10deg)}80%{transform:rotate(10deg)}}
  .qs h3{margin:.5em 0 .2em}.mchips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .mchip{background:#fff;border:2px solid #e0f1e6;border-radius:99px;padding:.2em .8em;font-size:.85rem}
  ` }));

  let Q = null, greeted = false;
  const load = async () => { try { Q = await api('/quests'); } catch { } return Q; };
  const box = $('#quest');

  function renderBox() {
    if (!Q) return;
    const t = Q.tasks, chest = Q.chest.claimed ? '🎁 เปิดหีบวันนี้แล้ว' : Q.chest.ready ? '🎁 พร้อมเปิดหีบ! กดเลย' : `🎁 อีก ${3 - Q.done} ภารกิจเปิดหีบ`;
    box.innerHTML = `<b>📋 ภารกิจวันนี้ ${Q.done}/3</b><div class="qbar"><i style="width:${Q.done / 3 * 100}%"></i></div>`
      + t.map(x => `<div class="qi">${x.done ? '✅' : '⬜'} <span>${esc(x.label)}</span></div>`).join('')
      + `<div class="qf ${Q.chest.ready ? 'ready' : ''}">🔥 ${Q.streak.n} วัน · ${chest}</div>`;
    box.style.display = 'block';
    const alert = Q.chest.ready || Q.streak.milestones.some(m => m.state === 'ready') || (Q.classGoal && Q.classGoal.claimable);
    const ic = document.querySelector('#menu [data-k=mis] .ic');
    if (ic) { ic.querySelector('.dot')?.remove(); if (alert) ic.insertAdjacentHTML('beforeend', '<i class="dot"></i>'); }
  }

  window.gcQuests = async () => {
    await load(); renderBox();
    if (Q && !greeted) { greeted = true; toast(Q.done >= 3 ? `วันนี้ครบแล้ว 🎉 สตรีค ${Q.streak.n} วัน` : `วันนี้ทำแล้ว ${Q.done}/3 · สตรีค ${Q.streak.n} วัน 🔥`); }
  };

  function section(d) {
    const chest = d.chest.claimed ? '<span class="ok">✅ เปิดหีบวันนี้แล้ว พรุ่งนี้มาเปิดใหม่</span>'
      : d.chest.ready ? '<button onclick="gcClaim(\'chest\')">🎁 เปิดหีบรางวัล</button>' : `<span class="sm">ทำให้ครบ 3 ข้อเพื่อเปิดหีบ (เหลือ ${3 - d.done})</span>`;
    const ms = d.streak.milestones.map(m => m.state === 'ready' ? `<button onclick="gcClaim('streak',${m.m})">รับ ${m.m} วัน +${m.points}</button>`
      : `<span class="mchip">${m.state === 'claimed' ? '✅' : '🔒'} ${m.m} วัน</span>`).join('');
    const g = d.classGoal;
    const cls = g ? `<h3>🏫 เป้าหมายห้อง ${esc(g.classroom)}</h3><div class="sm">ทำภารกิจจริงรวมกันสัปดาห์นี้ ${g.count}/${g.target} ครั้ง (คุณทำ ${g.mine})</div>
      <div class="qb"><i style="width:${Math.min(100, g.count / g.target * 100)}%"></i></div>
      ${g.claimed ? '<span class="ok">✅ รับรางวัลห้องแล้ว</span>' : g.claimable ? `<button onclick="gcClaim('class')">รับรางวัลห้อง +${g.points}</button>` : g.count >= g.target ? '<span class="sm">ห้องทำครบแล้ว ส่งภารกิจจริงอย่างน้อย 1 ข้อเพื่อรับรางวัล</span>' : ''}` : '';
    return `<div class="qs"><h3>🔥 ภารกิจประจำวัน ${d.done}/3</h3>
      ${d.tasks.map(x => `<div class="row"><span>${x.done ? '✅' : '⬜'} ${esc(x.label)}<div class="sm">${esc(x.hint)}</div></span></div>`).join('')}
      <div class="row"><span><b>หีบรางวัลประจำวัน</b><div class="sm">สุ่มได้ตั้งแต่ธรรมดาจนถึงตำนาน</div></span>${chest}</div>
      <h3>🔥 สตรีค ${d.streak.n} วัน</h3><div class="sm">ขาดได้ 1 วันต่อสัปดาห์ สตรีคไม่หาย</div><div class="mchips">${ms}</div>${cls}<hr style="border:0;border-top:2px solid #e0f1e6;margin:14px 0"></div>`;
  }

  const oMis = showMissions;
  showMissions = async function () {
    await oMis();
    const d = await load(); if (!d) return;
    renderBox(); $('#panel h2')?.insertAdjacentHTML('afterend', section(d));
  };

  window.gcClaim = async (k, m) => {
    try {
      const r = await api(k === 'chest' ? '/quests/chest/claim' : k === 'class' ? '/quests/class/claim' : `/quests/streak/${m}/claim`, { method: 'POST' });
      await refresh();
      openPanel(`<div style="text-align:center"><div class="gift">${k === 'chest' ? '🎁' : '🏆'}</div><h2>${r.tier ? `ได้หีบระดับ “${esc(r.tier)}”!` : 'รับรางวัลแล้ว!'}</h2>
        <p class="ok">+${r.points} Point · +${r.coins} Coin · +${r.exp} EXP</p><button onclick="closePanel()">เยี่ยมเลย!</button></div>`);
    } catch (e) { toast(e.message); }
  };

  if (ME) window.gcQuests();
})();