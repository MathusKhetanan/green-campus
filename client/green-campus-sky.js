/* Green Campus — ท้องฟ้า เมฆ ภูเขาไกล ๆ และมุมกล้องที่เห็นขอบฟ้า (วางหลัง green-campus-hud.js) */
(() => {
  const T = THREE, HORIZON = 0xd4eef6;
  const cv = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return new T.CanvasTexture(c); };

  /* ---------- โดมท้องฟ้า (ไล่สีน้ำเงิน → ฟ้าอ่อนที่ขอบฟ้า สีเดียวกับหมอก) ---------- */
  scene.background = new T.Color(HORIZON);
  scene.fog.color.set(HORIZON); scene.fog.near = 55; scene.fog.far = 150;
  const sky = new T.Mesh(new T.SphereGeometry(150, 24, 16), new T.MeshBasicMaterial({
    side: T.BackSide, fog: false, depthTest: false, depthWrite: false,
    map: cv(2, 256, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#3f9fe8'); r.addColorStop(.3, '#7cc4f0'); r.addColorStop(.5, '#d4eef6'); r.addColorStop(1, '#d4eef6'); g.fillStyle = r; g.fillRect(0, 0, w, h); })
  }));
  sky.renderOrder = -1000; sky.frustumCulled = false; scene.add(sky);

  /* ---------- เมฆ ---------- */
  const ct = cv(256, 128, g => { [[70, 70, 46], [120, 56, 54], [175, 70, 48], [100, 80, 40], [150, 82, 40]].forEach(([x, y, r]) => { const k = g.createRadialGradient(x, y, 4, x, y, r); k.addColorStop(0, 'rgba(255,255,255,.95)'); k.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = k; g.fillRect(0, 0, 256, 128); }); });
  const clouds = Array.from({ length: 16 }, (_, i) => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: ct, transparent: true, fog: false, depthWrite: false, opacity: .92 }));
    const w = 40 + Math.random() * 30; s.scale.set(w, w * .4, 1);
    s.userData = { a: i / 16 * 6.283 + Math.random() * .3, y: 24 + Math.random() * 26, R: 105 + Math.random() * 20 };
    scene.add(s); return s;
  });

  /* ---------- เนินเขาไกล ๆ รอบฉาก ---------- */
  const hm = new T.MeshLambertMaterial({ color: 0x6fbf86 });
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * 6.283 + Math.random() * .2, R = 82 + Math.random() * 22, s = 18 + Math.random() * 16, m = new T.Mesh(new T.SphereGeometry(1, 16, 10), hm);
    m.scale.set(s * 1.5, s * .55, s); m.position.set(Math.cos(a) * R, -s * .15, Math.sin(a) * R); m.rotation.y = Math.random() * 3; scene.add(m);
  }

  /* ---------- มุมกล้อง: ต่ำลงและมองตรงไปข้างหน้า จึงเห็นท้องฟ้า ---------- */
  const cp = new T.Vector3(), lp = new T.Vector3(), tp = new T.Vector3(), tl = new T.Vector3(); let init = false, last = performance.now();
  let pitch = .22, pf = 0, ly = 0, view = 2; // pitch = มุมกล้องรอบตัว (มุม 2/3), pf = มุมเงย/ก้มของหัว (มุม 1), view = 1/2/3 แบบ Minecraft
  canvas.addEventListener('pointerdown', e => { ly = e.clientY; });
  canvas.addEventListener('pointermove', e => {
    if (!drag.on || e.pointerId !== drag.id) return;
    const dy = e.clientY - ly; ly = e.clientY;
    if (view === 1) pf = Math.max(-1.4, Math.min(1.4, pf + dy * .005)); else pitch = Math.max(-.1, Math.min(1.25, pitch + dy * .005));
  });
  const VN = ['', 'บุคคลที่ 1', 'บุคคลที่ 3 (มองจากหลัง)', 'บุคคลที่ 3 (มองจากหน้า)'];
  const vb = document.createElement('button');
  vb.style.cssText = 'position:fixed;z-index:6;top:max(10px,env(safe-area-inset-top));right:10px;width:48px;height:48px;border-radius:50%;padding:0;font-size:1.05rem;background:linear-gradient(180deg,#fff,#dff3e6);color:#0f2a22;border:2px solid #fff;box-shadow:0 4px 12px rgba(15,42,34,.25)';
  vb.setAttribute('aria-label', 'เปลี่ยนมุมมอง'); document.body.appendChild(vb);
  function setView(n) { view = n; vb.textContent = '🎥' + n; toast('มุมมอง ' + n + ': ' + VN[n]); }
  vb.textContent = '🎥' + view; vb.onclick = () => !busy && setView(view % 3 + 1);
  addEventListener('keydown', e => { if (!busy && !e.repeat && (e.key === '1' || e.key === '2' || e.key === '3')) setView(+e.key); });
  const r0 = renderer.render.bind(renderer);
  renderer.render = function (s, c) {
    if (s === scene && c === cam) {
      const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
      const P = player.position, sx = Math.sin(camAng), cz = Math.cos(camAng);
      const D = 10.5, dh = D * Math.cos(pitch), hh = Math.max(.8, 1.8 + D * Math.sin(pitch)), a = 8 * Math.max(0, Math.min(1, 1 - pitch / .9)); // มองลงมาก = จ้องตัวละคร, มองต่ำ = มองไปข้างหน้าเห็นฟ้า
      if (view === 1) { // บุคคลที่ 1: กล้องอยู่ที่หัว มองตามทิศที่หัน
        const ch = Math.cos(pf), fx = -sx * ch, fz = -cz * ch, fy = -Math.sin(pf);
        tp.set(P.x + fx * .2, P.y + 2.45, P.z + fz * .2); tl.set(tp.x + fx * 10, tp.y + fy * 10, tp.z + fz * 10);
      } else if (view === 2) { // บุคคลที่ 3 (มองจากด้านหลัง)
        tp.set(P.x + sx * dh, hh, P.z + cz * dh); tl.set(P.x - sx * a, 2.5 + a * .25, P.z - cz * a);
      } else { // บุคคลที่ 3 (มองจากด้านหน้า)
        tp.set(P.x - sx * dh, hh, P.z - cz * dh); tl.set(P.x, 2.2, P.z);
      }
      player.visible = view !== 1;
      if (!init || view === 1) { cp.copy(tp); lp.copy(tl); init = true; }
      cp.lerp(tp, .12); lp.lerp(tl, .12); cam.position.copy(cp); cam.lookAt(lp);
      sky.position.copy(cam.position);
      clouds.forEach(k => { const d = k.userData; d.a += dt * .008; k.position.set(Math.cos(d.a) * d.R, d.y, Math.sin(d.a) * d.R); });
    }
    r0(s, c);
  };
})();