/* Green Campus — HUD & เมนูล่างให้เหมือนภาพตัวอย่าง (วางหลัง green-campus-ui.js) */
(() => {
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `
  #mini{left:10px;right:auto;width:112px;height:112px}
  #cmp{top:max(10px,env(safe-area-inset-top));left:56px;width:22px;height:22px;margin-top:-4px;border-radius:50%;background:#e8554a;color:#fff;font-size:.72rem;font-weight:600;display:grid;place-items:center;z-index:6;border:2px solid #fff}
  #stat{display:block;left:134px;top:max(14px,env(safe-area-inset-top));min-width:0;width:min(230px,calc(100vw - 144px));padding:8px 14px}
  #stat .gcn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #quest{top:calc(max(10px,env(safe-area-inset-top)) + 122px);left:10px;width:min(240px,calc(100vw - 20px));background:rgba(255,255,255,.9);border:2px solid #fff;border-radius:18px;padding:10px 12px;font-size:.85rem;box-shadow:0 6px 18px rgba(15,42,34,.2);pointer-events:auto;cursor:pointer;display:none}
  .qi{display:flex;gap:6px;align-items:center;margin-top:5px}.qi span{flex:1}.qi i{font-style:normal;opacity:.7}
  @media(max-height:560px){#quest{display:none!important}}
  #chips{top:max(10px,env(safe-area-inset-top));display:flex;gap:8px;align-items:center;pointer-events:auto;left:134px;margin-top:66px}
  @media(min-width:900px){#chips{left:50%;transform:translateX(-50%);margin-top:0}}
  .cp{display:flex;align-items:center;gap:6px;background:linear-gradient(180deg,#fff,#eaf8ef);border:2px solid #fff;border-radius:99px;padding:3px 4px 3px 12px;font-weight:600;box-shadow:0 4px 12px rgba(15,42,34,.2)}
  .cp button{width:26px;height:26px;padding:0;border-radius:50%;line-height:1;font-size:1rem}
  .gear{width:40px;height:40px;border-radius:50%;padding:0;font-size:1.2rem;background:linear-gradient(180deg,#fff,#dff3e6);box-shadow:0 4px 12px rgba(15,42,34,.2)}
  #menu{background:transparent;border:0;box-shadow:none;backdrop-filter:none;padding:0;gap:10px}
  #menu button{min-width:58px;padding:0;gap:3px;background:transparent}
  #menu button:hover{background:transparent;transform:translateY(-4px)}
  #menu .ic{width:54px;height:54px;border-radius:18px;border:3px solid #fff;display:grid;place-items:center;font-size:1.7rem;box-shadow:0 4px 0 rgba(15,42,34,.25)}
  #menu small{color:#fff;font-weight:600;font-size:.72rem;text-shadow:0 1px 3px rgba(15,42,34,.8)}
  #hint{bottom:112px}#pad{bottom:110px;border:3px solid rgba(255,255,255,.7)}
  @media(max-width:480px){#menu .ic{width:46px;height:46px;font-size:1.4rem}#menu{gap:6px}#menu button{min-width:48px}}
  ` }));
  const mk = (id, cls) => { const d = document.createElement('div'); d.id = id; d.className = cls || ''; document.body.appendChild(d); return d; };
  const chips = mk('chips', 'hud'), quest = mk('quest', 'hud'), cmp = mk('cmp', 'hud'); cmp.textContent = 'N';
  quest.onclick = () => !busy && showMissions();

  /* ---------- เมนูล่าง ---------- */
  const M = [
    ['🎒', 'กระเป๋า', '#7fb2ff', '#4f86e0', () => showProfile()], ['🏆', 'ภารกิจ', '#ffd75e', '#e9ae1c', () => showMissions()],
    ['🏪', 'ร้านค้า', '#ff9a8a', '#e8554a', () => showShop()], ['🥇', 'อันดับ', '#c5a3ff', '#8f63e0', () => showRank()],
    ['🎓', 'ใบประกาศ', '#6ed9ae', '#2f9e5b', () => showCerts()], ['☰', 'เมนู', '#9db8c9', '#6a8aa0', () => settings()]];
  $('#menu').innerHTML = '';
  M.forEach(([e, l, a, b, f]) => { const x = document.createElement('button'); x.innerHTML = `<span class="ic" style="background:linear-gradient(180deg,${a},${b})">${e}</span><small>${l}</small>`; x.onclick = f; $('#menu').appendChild(x); });

  /* ---------- ตั้งค่า (ปุ่มเฟือง / เมนู) ---------- */
  const sOn = () => renderer.shadowMap.enabled;
  window.gcShadow = () => {
    const on = !sOn(); renderer.shadowMap.enabled = on; sun.castShadow = on;
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); });
    try { localStorage.setItem('gc_sh', on ? '1' : '0'); } catch { }
    const b = $('#shb'); if (b) b.textContent = on ? 'เปิดอยู่' : 'ปิดอยู่';
  };
  function settings() {
    openPanel(`<h2>⚙️ ตั้งค่า</h2><div class="row"><span>เงาในฉาก<div class="sm">ปิดเพื่อให้เกมลื่นขึ้นบนมือถือ</div></span><button id="shb" onclick="gcShadow()">${sOn() ? 'เปิดอยู่' : 'ปิดอยู่'}</button></div>
    <div class="row"><span>ออกจากระบบ</span><button class="alt" onclick="logout()">ออก</button></div>`);
  }
  window.gcSettings = settings;
  try { if (localStorage.getItem('gc_sh') === '0') gcShadow(); } catch { }

  /* ---------- HUD บน + กล่องภารกิจประจำวัน ---------- */
  async function loadQuest() {
    try {
      const ms = await api('/missions'); window._ms = ms;
      const d = ms.filter(m => m.type === 'daily'), L = (d.length ? d : ms).slice(0, 3);
      quest.innerHTML = '<b>📋 ภารกิจในวันนี้</b>' + L.map(m => `<div class="qi">${m.used >= m.limit ? '✅' : '⬜'} <span>${esc(m.title)}</span><i>${m.used}/${m.limit}</i></div>`).join('');
      quest.style.display = L.length ? 'block' : 'none';
    } catch { }
  }
  renderStat = function () {
    const u = ME.user, pct = Math.min(100, (u.exp - u.expThis) / (u.expNext - u.expThis) * 100);
    $('#stat').innerHTML = `<div class="gcn">🌱 <b>${esc(u.name)}</b> <span class="sm">${esc(u.classroom)}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
    <div class="sm">Lv.${u.level} ${esc(u.title)} · ${u.exp}/${u.expNext}</div>`;
    chips.innerHTML = `<span class="cp">🟢 ${u.points}<button onclick="showMissions()" aria-label="รับแต้มเพิ่ม">＋</button></span><span class="cp">🪙 ${u.coins}<button onclick="showShop()" aria-label="ไปร้านค้า">＋</button></span><button class="gear" onclick="gcSettings()" aria-label="ตั้งค่า">⚙️</button>`;
    loadQuest();
  };
  if (ME) renderStat();
})();