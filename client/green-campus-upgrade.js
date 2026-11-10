/* Green Campus — Visual Upgrade (วางต่อท้ายสคริปต์หลัก ไม่ต้องแก้โค้ดเดิม) */
(() => {
  const T = THREE, LOW = matchMedia('(pointer:coarse)').matches;
  const mat = (c, o = {}) => new T.MeshLambertMaterial({ color: c, ...o });
  const cv = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; };
  const tex = (c, rep) => { const t = new T.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); } return t; };

  /* ---------- UI (HUD / เมนู / หน้าต่าง) ---------- */
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `
  #veil{backdrop-filter:blur(4px)}
  #panel{border-radius:26px;border:3px solid #fff;background:linear-gradient(180deg,#fff,#eaf8ef);box-shadow:0 18px 50px rgba(0,0,0,.3);animation:gcpop .22s ease}
  @keyframes gcpop{from{transform:scale(.92);opacity:0}}
  #panel h2{color:#176b3b}
  button{background:linear-gradient(180deg,#52c97f,#2f9e5b);box-shadow:0 3px 0 #207a44;transition:transform .1s}
  button:active{transform:translateY(2px);box-shadow:0 1px 0 #207a44}
  button.alt{background:linear-gradient(180deg,#eefaf1,#d9f2e1);box-shadow:0 3px 0 #b5dcc3}
  .row,.row:first-of-type{background:#fff;border:2px solid #e0f1e6;border-radius:16px;padding:12px 14px;margin:8px 0;box-shadow:0 2px 0 #e0f1e6}
  .grid .alt{padding:.9em .5em;font-weight:600;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.2)}
  .grid .alt:nth-child(1){background:linear-gradient(180deg,#5ca0e0,#3b83c4);box-shadow:0 4px 0 #2a64a0}
  .grid .alt:nth-child(2){background:linear-gradient(180deg,#52c97f,#2f9e5b);box-shadow:0 4px 0 #207a44}
  .grid .alt:nth-child(3){background:linear-gradient(180deg,#ffd75e,#e9ae1c);box-shadow:0 4px 0 #b88410}
  .grid .alt:nth-child(4){background:linear-gradient(180deg,#f2766c,#e8554a);box-shadow:0 4px 0 #b43b32}
  .bin{box-shadow:0 4px 0 rgba(0,0,0,.22);font-size:1rem}
  #stat{background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(232,249,238,.9));backdrop-filter:blur(6px);border:2px solid #fff;border-radius:20px;padding:10px 16px;min-width:230px;box-shadow:0 6px 18px rgba(15,42,34,.2)}
  #stat .m span{background:#fff;border-radius:99px;padding:.1em .7em;font-weight:600;box-shadow:inset 0 0 0 2px #e0f1e6}
  .bar{height:12px;border-radius:8px;box-shadow:inset 0 1px 3px rgba(0,0,0,.15)}
  .bar i{background:linear-gradient(90deg,#8be39a,#2f9e5b)}
  #mini{border:5px solid #fff;box-shadow:0 6px 18px rgba(15,42,34,.25)}
  #hint{background:rgba(15,42,34,.9);border:2px solid #ffc83d;box-shadow:0 4px 14px rgba(0,0,0,.25)}
  #menu{background:rgba(255,255,255,.9);backdrop-filter:blur(8px);border:2px solid #fff;border-radius:24px;padding:8px 10px;gap:8px;box-shadow:0 8px 22px rgba(15,42,34,.22)}
  #menu button{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:62px;border-radius:16px;box-shadow:none;transition:transform .15s}
  #menu button .ic{font-size:1.6rem;line-height:1}
  #menu button small{font-size:.72rem;font-weight:500}
  #menu button:hover{transform:translateY(-4px)}
  ` }));
  document.querySelectorAll('#menu button').forEach(b => { const [e, ...r] = b.textContent.split(' '); b.innerHTML = `<span class="ic">${e}</span><small>${r.join(' ')}</small>`; });

  /* ---------- แสง เงา ท้องฟ้า ---------- */
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  sun.position.set(25, 45, 18); sun.intensity = .85; sun.castShadow = true; sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 130 }); sun.shadow.bias = -.0005;
  scene.background = tex(cv(2, 256, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#5db8ee'); r.addColorStop(.6, '#bfe6f5'); r.addColorStop(1, '#f3fbf4'); g.fillStyle = r; g.fillRect(0, 0, w, h); }));
  scene.fog.color.set(0xd4eef6); scene.fog.near = 50; scene.fog.far = 130;

  /* ---------- พื้นหญ้า / ลานน้ำพุ ---------- */
  ground.material.map = tex(cv(256, 256, g => { g.fillStyle = '#8fd19e'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(120,200,130,.35)' : 'rgba(70,160,100,.22)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 9, 0, 7); g.fill(); } }), 14);
  ground.material.color.set(0xffffff);
  const og = new T.Mesh(new T.PlaneGeometry(500, 500), mat(0x7fc48f)); og.rotation.x = -Math.PI / 2; og.position.y = -.05; scene.add(og);
  const disc = (r, c, y) => { const m = new T.Mesh(new T.CircleGeometry(r, 48), mat(c)); m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); return m; };
  const cyl = (rt, rb, h, c, x, y, z, s = 32) => { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, s), mat(c)); m.position.set(x, y, z); scene.add(m); return m; };
  disc(9, 0xcfc8b2, .06); disc(8.4, 0xf0ead8, .07);
  cyl(3.6, 3.8, 1.1, 0xdad4c2, 0, .55, 0); cyl(.5, .8, 1.8, 0xdad4c2, 0, .9, 0); cyl(1.4, .9, .35, 0xdad4c2, 0, 1.9, 0, 24);
  const water = disc(3.1, 0x6cc8ec, 1.14); water.material.transparent = true; COLL.push({ x: 0, z: 0, r: 3.7 });
  const N = 160, pp = new Float32Array(N * 3), ps = Array.from({ length: N }, () => ({ t: Math.random() * 1.5, a: Math.random() * 6.28, vr: .5 + Math.random() * 1.6, vy: 4 + Math.random() * 3 }));
  const pts = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(pp, 3)), new T.PointsMaterial({ color: 0xeaf9ff, size: .28, transparent: true, opacity: .85 })); pts.frustumCulled = false; scene.add(pts);

  /* ---------- อาคาร ---------- */
  const winM = mat(0x9fd8f0, { emissive: 0x2f6f8f });
  function deco(x, z, w, h, d, roof, win, door) {
    box(w + .8, .4, d + .8, roof, x, h + .2, z);
    if (!win) return;
    const cols = Math.floor((w - 1) / 2.3), rows = Math.floor((h - 1.2) / 2.4), zf = z + d / 2 + .03;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const off = -(cols - 1) * 1.15 + c * 2.3; if (door && r === 0 && Math.abs(off) < 1.8) continue;
      const m = new T.Mesh(new T.PlaneGeometry(1.2, 1.5), winM); m.position.set(x + off, 2.2 + r * 2.4, zf); scene.add(m);
    }
    if (door) { const m = new T.Mesh(new T.PlaneGeometry(1.8, 2.6), mat(0x7a5236)); m.position.set(x, 1.3, zf); scene.add(m); }
  }
  deco(-22, -20, 12, 7, 8, 0x6d8fb0, true, true);
  deco(-22, 20, 8, 4, 6, 0x7b52c9, true, false);
  deco(22, 20, 7, 4, 5, 0x2f9e5b, false, false);
  deco(20, -18, 6, 2.5, 3, 0x1f7a44, false, false);
  box(7.4, 1.7, .3, 0x1c3b6b, -22, 8.3, -16.6);
  { const s = new T.Mesh(new T.PlaneGeometry(7, 1.5), new T.MeshBasicMaterial({ map: tex(cv(512, 110, (g, w, h) => { g.fillStyle = '#1c3b6b'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '600 52px Prompt,sans-serif'; g.fillText('SURATTHANI', w / 2, 52); g.font = '400 30px Prompt,sans-serif'; g.fillText('VOCATIONAL COLLEGE', w / 2, 92); })) })); s.position.set(-22, 8.3, -16.4); scene.add(s); }
  document.fonts.ready.then(() => scene.children.filter(o => o.isSprite && Math.abs(o.position.x + 22) < .1 && Math.abs(o.position.z + 20) < .1 && o.position.y > 9).forEach(o => o.position.y = 11.4));
  for (let i = 0; i < 6; i++) box(7 / 6, .18, 2.2, i % 2 ? 0xffffff : 0x2f9e5b, 22 - 3.5 + 7 / 12 + i * 7 / 6, 3.5, 23.5).rotation.x = .3;
  { const m = new T.Mesh(new T.PlaneGeometry(4.4, 1.6), mat(0x9fd8f0, { emissive: 0x2f6f8f })); m.position.set(22, 1.7, 22.53); scene.add(m); }
  Object.values(BINS).forEach(([, c], i) => cyl(.42, .36, 1.1, c, 20 - 2.25 + i * 1.5, .55, -15.8, 14));

  /* ---------- ต้นไม้ พุ่มไม้ ดอกไม้ เสาไฟ ---------- */
  const fg = new T.SphereGeometry(1, 10, 8), fm = [0x3fae5f, 0x57c274, 0x2f8f4e, 0xf6a6c1, 0xffc2d6, 0xf08bb0].map(c => mat(c));
  const crown = (x, z, pink) => [[0, 3.6, 0, 1.7], [.9, 4.4, .3, 1.2], [-.8, 4.6, -.4, 1.3]].forEach(([dx, y, dz, r], i) => { const m = new T.Mesh(fg, fm[(pink ? 3 : 0) + i]); m.position.set(x + dx, y, z + dz); m.scale.set(r, r * .85, r); scene.add(m); });
  scene.children.filter(o => o.geometry && o.geometry.type === 'ConeGeometry').forEach(c => { c.visible = false; crown(c.position.x, c.position.z, rand() < .2); });
  const trunkG = new T.BoxGeometry(.5, 2, .5), trunkM = mat(0x7a5236);
  for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283 + rand() * .1, R = 44 + rand() * 10, x = Math.cos(a) * R, z = Math.sin(a) * R, t = new T.Mesh(trunkG, trunkM); t.position.set(x, 1, z); scene.add(t); crown(x, z, rand() < .15); }
  const ok = (x, z) => Math.abs(x) > 3.8 && Math.abs(z) > 3.8 && Math.hypot(x, z) > 10 && !ZONES.some(q => Math.abs(q[1] - x) < q[4][0] / 2 + 2 && Math.abs(q[2] - z) < q[4][2] / 2 + 2) && !SPOTS.some(q => Math.hypot(q.x - x, q.z - z) < 3.5);
  const D = new T.Object3D(), gp = [0x3fae5f, 0x57c274, 0x2f8f4e], fp = [0xff8fb1, 0xffd84d, 0xffffff, 0xc79bff, 0xff7a6b], bp = [];
  const bushes = new T.InstancedMesh(new T.SphereGeometry(.7, 10, 8), mat(0xffffff), 60), fl = new T.InstancedMesh(new T.SphereGeometry(.17, 6, 5), mat(0xffffff), 260);
  for (let i = 0, n = 0; i < 400 && n < 60; i++) { const x = (rand() - .5) * 2 * (WORLD - 2), z = (rand() - .5) * 2 * (WORLD - 2); if (!ok(x, z)) continue; const s = .8 + rand() * .8; D.position.set(x, .35, z); D.scale.set(s, s * .75, s); D.updateMatrix(); bushes.setMatrixAt(n, D.matrix); bushes.setColorAt(n, new T.Color(gp[n % 3])); bp.push([x, z, s]); n++; }
  bushes.count = bp.length; scene.add(bushes);
  if (bp.length) { for (let k = 0; k < 260; k++) { const b = bp[k % bp.length], a = rand() * 6.28, r = b[2] * (.5 + rand() * .7); D.position.set(b[0] + Math.cos(a) * r, .45 + rand() * .35, b[1] + Math.sin(a) * r); D.scale.set(1, 1, 1); D.updateMatrix(); fl.setMatrixAt(k, D.matrix); fl.setColorAt(k, new T.Color(fp[k % 5])); } scene.add(fl); }
  const lm = mat(0x2d3b38), bulb = new T.MeshBasicMaterial({ color: 0xfff2b0 });
  const lamp = (x, z) => { const p = new T.Mesh(new T.CylinderGeometry(.08, .11, 3.6, 8), lm); p.position.set(x, 1.8, z); const b = new T.Mesh(new T.SphereGeometry(.28, 10, 8), bulb); b.position.set(x, 3.8, z); scene.add(p, b); COLL.push({ x, z, r: .15 }); };
  [-24, -14, 14, 24].forEach(v => { lamp(-3.3, v); lamp(3.3, v); }); [-28, -16, 16, 28].forEach(v => { lamp(v, -3.3); lamp(v, 3.3); });

  /* ---------- ตัวละคร (ชุดนักเรียน ผมยาว โบว์ แขน รองเท้า) ---------- */
  const U = player.userData, skin = mat(0xffdcb8), add = (m, x, y, z) => { m.position.set(x, y, z); player.add(m); return m; };
  const plaid = tex(cv(64, 64, g => { g.fillStyle = '#bbb'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 64; i += 16) { g.fillRect(i, 0, 4, 64); g.fillRect(0, i, 64, 4); } g.fillStyle = 'rgba(60,60,60,.35)'; for (let i = 8; i < 64; i += 16) { g.fillRect(i, 0, 2, 64); g.fillRect(0, i, 64, 2); } }), 4);
  U.skirt = add(new T.Mesh(new T.CylinderGeometry(.5, .85, .65, 20, 1, true), mat(0x2b4a7a, { map: plaid, side: T.DoubleSide })), 0, .95, 0);
  U.long = add(new T.Mesh(new T.CylinderGeometry(.55, .35, 1.7, 14), mat(0x3b2a20)), 0, 1.75, -.38); U.long.scale.z = .55;
  U.arms = [-1, 1].map(s => { const a = new T.Group(); a.position.set(s * .58, 1.8, 0); const m = new T.Mesh(new T.CylinderGeometry(.12, .11, .85, 8), U.body.material); m.position.y = -.4; const h = new T.Mesh(new T.SphereGeometry(.13, 8, 6), skin); h.position.y = -.88; a.add(m, h); a.rotation.z = s * .12; player.add(a); return a; });
  [-1, 1].forEach(s => { const m = new T.Mesh(new T.SphereGeometry(.2, 10, 8), mat(0xffffff)); m.scale.set(1, .6, 1.5); add(m, s * .2, .08, .1); const b = new T.Mesh(new T.SphereGeometry(.14, 8, 6), mat(0x2f9e5b)); b.scale.set(1.4, 1, .7); add(b, s * .5, 2.72, -.1); });
  player.children.forEach(c => { if (c.geometry && c.geometry.parameters && c.geometry.parameters.radius === .07) c.scale.set(1.5, 2, 1); });
  U.tail.visible = false;
  applyOutfit = function () {
    if (!ME) return; const o = ME.user.outfit, f = o.gender === 'f';
    U.body.material.color.set(o.shirt); U.legs.material.color.set(o.pants); U.skirt.material.color.set(o.pants); U.skirt.visible = f;
    U.hair.material.color.set(o.hair); U.long.material.color.set(o.hair); U.long.visible = f; U.tail.visible = false;
  };
  applyOutfit();

  /* ---------- น้องใบไม้ มาสคอต ---------- */
  const old = scene.children.find(o => o.isGroup && o !== player && o.userData.body && Math.abs(o.position.x - 4) < .1 && Math.abs(o.position.z + 4) < .1), mas = new T.Group();
  if (old) {
    old.visible = false; mas.position.copy(old.position); mas.rotation.y = .3; scene.add(mas);
    const b = new T.Mesh(new T.SphereGeometry(.85, 20, 16), mat(0xffffff)); b.scale.set(1.1, .95, 1); b.position.y = 1.1; mas.add(b);
    [-1, 1].forEach(s => {
      const e = new T.Mesh(new T.SphereGeometry(.1, 8, 6), mat(0x222222)); e.position.set(s * .3, 1.25, .85);
      const c = new T.Mesh(new T.SphereGeometry(.12, 8, 6), mat(0xffb3c1)); c.scale.set(1.3, .7, .5); c.position.set(s * .5, 1, .78);
      const l = new T.Mesh(new T.SphereGeometry(.3, 10, 8), mat(0x57c274)); l.scale.set(.5, .12, 1.3); l.position.set(s * .22, 2.1, 0); l.rotation.z = -s * .6; mas.add(e, c, l);
    });
  }

  /* ---------- เงา + อนิเมชันเสริม ---------- */
  scene.traverse(o => {
    if (!o.isMesh) return; const g = o.geometry.type;
    o.castShadow = o !== ground && !/Plane|Circle|Torus/.test(g); o.receiveShadow = true;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true);
  });
  const c2 = new T.Clock();
  (function tick() {
    requestAnimationFrame(tick); const dt = Math.min(c2.getDelta(), .05), t = c2.elapsedTime;
    ps.forEach((p, i) => {
      p.t += dt; let y = 2.1 + p.vy * p.t - 5 * p.t * p.t;
      if (y < 1.2) { p.t = 0; p.a = Math.random() * 6.28; y = 2.1; }
      pp[i * 3] = Math.cos(p.a) * p.vr * p.t; pp[i * 3 + 1] = y; pp[i * 3 + 2] = Math.sin(p.a) * p.vr * p.t;
    });
    pts.geometry.attributes.position.needsUpdate = true; water.material.opacity = .88 + Math.sin(t * 2) * .05;
    const sw = player.position.y > .001 ? Math.sin(t * 12) * .7 : 0; U.arms[0].rotation.x = sw; U.arms[1].rotation.x = -sw;
    if (old) mas.position.y = Math.sin(t * 3) * .15;
  })();
})();