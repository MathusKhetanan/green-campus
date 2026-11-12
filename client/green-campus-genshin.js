/* Green Campus — Genshin-style visual pass (วางเป็นสคริปต์สุดท้ายใน index.html)
   ต้องมี three r128 + สคริปต์หลัก + upgrade/ui/hud/sky ก่อนหน้า
   ไม่ต้องใช้ไฟล์ภายนอก / ไม่ต้องใช้ EffectComposer
   ปรับค่าความสว่าง สี เส้นขอบได้ที่ก้อน CFG ด้านล่าง */
(() => {
  const T = THREE, LOW = matchMedia('(pointer:coarse)').matches;

  const CFG = {
    hemiSky: '#f4f8ff', hemiGround: '#7aa6c8', hemiI: .45,   // แสงฟ้า: เงาจะออกโทนฟ้า-ม่วงแบบเกมอนิเมะ
    sunColor: '#fff1d0', sunI: .62,                           // แสงอาทิตย์โทนอุ่น
    outlineEnv: '#233b30', outlineChar: '#3b2a2e',            // สีเส้นขอบ
    outlineEnvW: .06, outlineCharW: .028,                     // ความหนาเส้นขอบ (หน่วยโลก)
    rim: '#cff6ff', rimI: .22,                                // แสงขอบวัตถุ
    grass: LOW ? 1100 : 2600, sparkles: LOW ? 60 : 140,
    css: 'saturate(1.22) contrast(1.07) brightness(1.03)',    // โทนสีรวม
  };

  /* ================= 1) แสง ================= */
  const hemi = scene.children.find(o => o.isHemisphereLight);
  if (hemi) { hemi.color.set(CFG.hemiSky); hemi.groundColor.set(CFG.hemiGround); hemi.intensity = CFG.hemiI; }
  sun.color.set(CFG.sunColor); sun.intensity = CFG.sunI;
  const SUNDIR = new T.Vector3(25, 45, 18).normalize();
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  scene.add(sun.target);

  /* ================= 2) Toon shading (3-4 ขั้น) + rim light ================= */
  const GRAD = new T.DataTexture(new Uint8Array([95, 170, 225, 255]), 4, 1, T.LuminanceFormat);
  GRAD.minFilter = GRAD.magFilter = T.NearestFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
  const GU = { value: 0 }, RIM = new T.Color(CFG.rim);

  function patch(n, sway) {
    n.onBeforeCompile = s => {
      s.uniforms.uRim = { value: RIM }; s.uniforms.uRimI = { value: CFG.rimI };
      s.fragmentShader = s.fragmentShader
        .replace('void main() {', 'uniform vec3 uRim;uniform float uRimI;\nvoid main() {')
        .replace('#include <dithering_fragment>', `
          float gcRim = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6) * uRimI;
          #ifdef USE_FOG
            gcRim *= (1.0 - fogFactor);
          #endif
          gl_FragColor.rgb += uRim * gcRim;
          #include <dithering_fragment>`);
      if (sway) {
        s.uniforms.uTime = GU;
        s.vertexShader = s.vertexShader
          .replace('void main() {', 'uniform float uTime;\nvoid main() {')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed.x += sin(uTime*1.8 + instanceMatrix[3].x*.6 + instanceMatrix[3].z*.5) * .14 * position.y;
          transformed.z += cos(uTime*1.5 + instanceMatrix[3].z*.7) * .08 * position.y;`);
      }
    };
    n.customProgramCacheKey = () => sway ? 'gc-toon-sway' : 'gc-toon';
    return n;
  }

  const cache = new WeakMap();
  function toon(m) {
    if (!m || m.isMeshToonMaterial || !m.isMeshLambertMaterial || m.vertexColors) return m;
    if (cache.has(m)) return cache.get(m);
    const n = patch(new T.MeshToonMaterial({
      color: m.color, map: m.map, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity,
      transparent: m.transparent, opacity: m.opacity, side: m.side, gradientMap: GRAD,
    }), false);
    cache.set(m, n); return n;
  }

  /* ================= 3) เส้นขอบ (inverted hull) ================= */
  const OLM = {}, olMat = c => OLM[c] || (OLM[c] = new T.MeshBasicMaterial({ color: c, side: T.BackSide }));
  const _s = new T.Vector3();
  function outlineOK(m) {
    if (m.isInstancedMesh || m.userData.gcOutline || m.userData.gcOL) return false;
    const g = m.geometry, mt = m.material; if (!g || !mt || Array.isArray(mt)) return false;
    if (!/^(Box|Sphere|Cylinder|Cone|Lathe)Geometry$/.test(g.type)) return false;
    if (mt.isMeshBasicMaterial || mt.transparent || mt.side === T.DoubleSide) return false;
    const p = g.parameters || {};
    if (p.openEnded || p.thetaLength < 3.1 || p.phiLength < 6.2) return false; // รูปทรงเปิด (หมวกผม ฯลฯ)
    g.boundingBox || g.computeBoundingBox(); g.boundingBox.getSize(_s);
    const k = m.scale, w = [_s.x * Math.abs(k.x), _s.y * Math.abs(k.y), _s.z * Math.abs(k.z)];
    if (Math.min(...w) < (m.parent === scene ? .25 : .14) || Math.max(...w) > 30) return false;               // บางเกิน (ทางเดิน เสาไฟ) / ใหญ่เกิน (พื้น)
    if (LOW && m.parent === scene && g.type !== 'BoxGeometry') return false;       // มือถือ: เว้นต้นไม้ เพื่อความลื่น
    if (LOW && m.parent === scene && Math.max(...w) < 2) return false;
    return true;
  }
  function outline(m) {
    m.userData.gcOL = 1;
    const char = m.parent !== scene, th = char ? CFG.outlineCharW : CFG.outlineEnvW, g = m.geometry, k = m.scale;
    g.boundingBox.getSize(_s);
    const f = (sz, ks) => 1 + 2 * th / Math.max(.05, sz * Math.abs(ks));
    const o = new T.Mesh(g, olMat(char ? CFG.outlineChar : CFG.outlineEnv));
    o.scale.set(f(_s.x, k.x), f(_s.y, k.y), f(_s.z, k.z)); o.userData.gcOutline = 1; o.matrixAutoUpdate = true;
    m.add(o);
  }

  /* ================= 4) หน้าตัวละครสไตล์อนิเมะ (ผู้เล่น + NPC) ================= */
  const eyeTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 160; const g = c.getContext('2d');
    g.save(); g.beginPath(); g.ellipse(64, 86, 50, 66, 0, 0, 7); g.clip();
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 160);
    const ir = g.createLinearGradient(0, 30, 0, 150); ir.addColorStop(0, '#17402c'); ir.addColorStop(.55, '#2f9e5b'); ir.addColorStop(1, '#b4f5c0');
    g.fillStyle = ir; g.beginPath(); g.ellipse(64, 94, 40, 58, 0, 0, 7); g.fill();
    g.fillStyle = '#0d1f17'; g.beginPath(); g.ellipse(64, 90, 17, 28, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, 128, 52);                       // เงาเปลือกตาบน
    g.restore();
    g.strokeStyle = '#2a1a1a'; g.lineWidth = 11; g.lineCap = 'round';                 // ขนตาบน
    g.beginPath(); g.ellipse(64, 86, 50, 66, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(44, 66, 13, 0, 7); g.fill(); g.beginPath(); g.arc(84, 118, 6.5, 0, 7); g.fill(); // ประกายตา
    return new T.CanvasTexture(c);
  })();
  const eyeM = new T.MeshBasicMaterial({ map: eyeTex, transparent: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const blushM = new T.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: .38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const eyes = [];

  /* สร้างตัวละครใหม่ทั้งตัวจากโค้ด (สัดส่วนชิบิอนิเมะ: หัวโต เอวคอด ขาเรียว กระโปรงบาน ผมเป็นช่อ)
     ขนาดหัว/ตำแหน่งตรงกับที่ green-campus-garden.js คาดไว้ (หัวสูง ~2.45) หมวก/แว่น/ปีกจึงยังใส่ได้ */
  const RAD = 0.69, HY = 2.45, HS = [1, .94, .97];
  const headZ = (x, y) => HS[2] * Math.sqrt(Math.max(0, RAD * RAD - x * x - ((y - HY) / HS[1]) ** 2));
  function part(parent, geo, mat, x = 0, y = 0, z = 0) {          // จัดรูปทรงให้จุดหมุนอยู่กึ่งกลาง (เส้นขอบจะได้ไม่เบี้ยว)
    geo.computeBoundingBox(); const c = new T.Vector3(); geo.boundingBox.getCenter(c); geo.translate(-c.x, -c.y, -c.z);
    const m = new T.Mesh(geo, mat); m.position.set(x + c.x, y + c.y, z + c.z); m.castShadow = true; parent.add(m); return m;
  }
  const lathe = pts => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), 24);

  function rig(g) {
    const U = g.userData; U.gcFace = 1;
    const col = m => (m && m.material && m.material.color) ? m.material.color.getHex() : 0xffffff;
    const shirtC = col(U.body), pantsC = col(U.legs), hairC = col(U.hair), isPlayer = g === player;
    const old = new Set([U.body, U.legs, U.hair, U.tail, U.skirt, U.long, ...(U.arms || [])].filter(Boolean));
    g.children.slice().forEach(c => {            // เอาของเก่าออก (เก็บหมวก/แว่น/ahoge ที่เกมอื่นเติมไว้)
      const gp = c.geometry && c.geometry.parameters, r = gp && gp.radius;
      if (old.has(c) || (c.geometry && c.geometry.type === 'SphereGeometry' && [.55, .07, .035, .1, .2, .14].includes(r))) g.remove(c);
    });
    const L = c => new T.MeshLambertMaterial({ color: c });
    const skin = L(0xffdcb8), hairM = L(hairC), shirtM = L(shirtC), pantsM = L(pantsC), skirtM = L(pantsC), white = L(0xffffff), green = L(0x2f9e5b);

    // ลำตัว (เอวคอด ไหล่โค้ง) + คอ
    U.body = part(g, lathe([[0, 1.0], [.27, 1.0], [.28, 1.12], [.31, 1.35], [.37, 1.62], [.34, 1.78], [.15, 1.88], [0, 1.9]]), shirtM);
    part(g, new T.CylinderGeometry(.13, .15, .26, 12), skin, 0, 1.93, 0);
    // ผ้าผูกคอ (ริบบิ้นเขียว)
    const rb = new T.Group(); rb.position.set(0, 1.76, .33);
    [-1, 1].forEach(s => { const w = new T.Mesh(new T.ConeGeometry(.1, .24, 4), green); w.rotation.z = s * Math.PI / 2; w.position.x = s * .1; rb.add(w); });
    rb.add(new T.Mesh(new T.SphereGeometry(.06, 8, 6), green)); g.add(rb);
    // สะโพก/กางเกง + กระโปรงบานจีบ
    U.legs = part(g, new T.CylinderGeometry(.3, .33, .32, 16), pantsM, 0, .92, 0);
    U.skirt = part(g, lathe([[0, .7], [.66, .7], [.62, .78], [.46, 1.0], [.34, 1.16], [0, 1.18]]), skirtM);
    // ขา (แกว่งได้) + รองเท้า
    U.legG = [-1, 1].map(s => {
      const lg = new T.Group(); lg.position.set(s * .17, .85, 0); g.add(lg);
      part(lg, new T.CylinderGeometry(.125, .1, .7, 10), pantsM, 0, -.36, 0);
      const sh = part(lg, new T.SphereGeometry(1, 12, 8), white, 0, -.76, .06); sh.scale.set(.16, .13, .27);
      return lg;
    });
    // แขน (U.arms ถูกแกว่งโดย green-campus-upgrade.js)
    U.arms = [-1, 1].map(s => {
      const a = new T.Group(); a.position.set(s * .45, 1.72, 0); a.rotation.z = s * .1; g.add(a);
      part(a, new T.CylinderGeometry(.13, .11, .42, 10), shirtM, 0, -.21, 0);
      part(a, new T.CylinderGeometry(.085, .075, .36, 10), skin, 0, -.55, 0);
      part(a, new T.SphereGeometry(.1, 10, 8), skin, 0, -.78, 0);
      return a;
    });
    // หัว
    const head = part(g, new T.SphereGeometry(RAD, 32, 24), skin, 0, HY, 0); head.scale.set(...HS);
    // ผม: หมวกผมครึ่งบน + หน้าม้าเป็นช่อ + ผมข้างหู + ผมด้านหลัง
    U.hair = part(g, new T.SphereGeometry(.75, 28, 18, 0, Math.PI * 2, 0, Math.PI * .46), hairM, 0, 2.52, -.02);
    [-1.0, -.55, -.18, .18, .55, 1.0].forEach((a, i) => {
      const st = part(g, new T.ConeGeometry(.14, .32, 6), hairM, Math.sin(a) * .72, 2.56, Math.cos(a) * .72);
      st.rotation.order = 'YXZ'; st.rotation.set(Math.PI - .25 - (i % 2) * .08, a, 0); st.scale.z = .45;
    });
    [-1, 1].forEach(s => { const lk = part(g, new T.ConeGeometry(.15, .8, 6), hairM, s * .68, 2.12, .02); lk.rotation.x = Math.PI; lk.rotation.z = s * .06; lk.scale.z = .55; });
    U.long = part(g, new T.SphereGeometry(1, 16, 12), hairM, 0, 2.2, -.3); U.long.scale.set(.74, .95, .52);
    // โบว์ผม
    const bow = new T.Group(); bow.position.set(.5, 2.9, -.05); bow.rotation.set(.2, .5, -.3);
    [-1, 1].forEach(s => { const w = new T.Mesh(new T.ConeGeometry(.15, .3, 4), green); w.rotation.z = s * Math.PI / 2; w.position.x = s * .14; bow.add(w); });
    bow.add(new T.Mesh(new T.SphereGeometry(.07, 8, 6), green)); g.add(bow);
    // ใบหน้า: ตาโต แก้มแดง ปาก
    [-1, 1].forEach(s => {
      const x = s * .26, ey = HY - .09, e = new T.Mesh(new T.PlaneGeometry(.3, .38), eyeM);
      e.position.set(x, ey, headZ(x, ey) + .012); e.rotation.y = Math.asin(x / RAD); g.add(e); eyes.push(e);
      const bx = s * .4, by = HY - .27, b = new T.Mesh(new T.CircleGeometry(.09, 14), blushM);
      b.position.set(bx, by, headZ(bx, by) + .01); b.rotation.y = Math.asin(bx / RAD); b.scale.set(1.5, .7, 1); g.add(b);
    });
    const mo = new T.Mesh(new T.SphereGeometry(1, 8, 6), new T.MeshBasicMaterial({ color: 0xc9605f }));
    mo.scale.set(.06, .02, .02); mo.position.set(0, HY - .31, headZ(0, HY - .31) + .005); g.add(mo);
    // ของเดิมที่ระบบอื่นอ้างถึง
    U.tail = new T.Mesh(new T.SphereGeometry(.01), hairM); U.tail.visible = false; g.add(U.tail);
    if (!isPlayer) { U.skirt.visible = false; U.long.visible = false; } // NPC: ทรงสั้นเรียบ
    scene.updateMatrixWorld();
  }
  let blinkAt = 3, blinkK = 0, lastX = 0, lastZ = 0;

  /* ================= 5) สแกนฉาก: toon + เส้นขอบ + แสงโคมไฟ ================= */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,244,190,1)'); r.addColorStop(.35, 'rgba(255,225,140,.45)'); r.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const glowM = new T.SpriteMaterial({ map: glowTex, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: .9 });

  function scan() {
    scene.traverse(o => {
      if (o.isGroup && o.userData && o.userData.body && o.userData.hair && !o.userData.gcFace && o.visible) { try { rig(o); } catch (e) { console.warn('rig', e); } }
      if (!o.isMesh || o.userData.gcOutline) return;
      if (Array.isArray(o.material)) o.material = o.material.map(toon); else o.material = toon(o.material);
      if (o.material && o.material.isMeshBasicMaterial && o.geometry.type === 'SphereGeometry' && o.material.color.getHex() === 0xfff2b0 && !o.userData.gcGlow) {
        o.userData.gcGlow = 1; const sp = new T.Sprite(glowM); sp.scale.set(2.6, 2.6, 1); o.add(sp);
      }
      if (!o.userData.gcOL && outlineOK(o)) outline(o);
    });
  }

  /* ================= 6) หญ้าไหวลม ================= */
  (function grass() {
    const geo = new T.ConeGeometry(.1, .8, 3, 1); geo.translate(0, .4, 0);
    const mat = patch(new T.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD }), true);
    const im = new T.InstancedMesh(geo, mat, CFG.grass), D = new T.Object3D(), cols = ['#5fc16f', '#7ad77f', '#3fa863', '#9be28a'];
    let sd = 4711; const R = () => (sd = sd * 16807 % 2147483647) / 2147483647;
    const free = (x, z) => Math.abs(x) > 3.2 && Math.abs(z) > 3.2 && Math.hypot(x, z) > 10 &&
      !ZONES.some(q => Math.abs(q[1] - x) < q[4][0] / 2 + 1.5 && Math.abs(q[2] - z) < q[4][2] / 2 + 1.5) &&
      !COLL.some(c => c.r && Math.hypot(c.x - x, c.z - z) < c.r + .6);
    let n = 0;
    for (let i = 0; i < CFG.grass * 4 && n < CFG.grass; i++) {
      const x = (R() - .5) * 2 * (WORLD - 1.5), z = (R() - .5) * 2 * (WORLD - 1.5); if (!free(x, z)) continue;
      const s = .7 + R() * .9; D.position.set(x, 0, z); D.rotation.set(0, R() * 6.28, 0); D.scale.set(s, s * (.8 + R() * .8), s); D.updateMatrix();
      im.setMatrixAt(n, D.matrix); im.setColorAt(n, new T.Color(cols[n % 4])); n++;
    }
    im.count = n; im.frustumCulled = false; im.userData.gcOL = 1; scene.add(im);
  })();

  /* ================= 7) ประกายลอย (อนุภาคเรืองแสง) ================= */
  const SN = CFG.sparkles, sp = new Float32Array(SN * 3), sd = Array.from({ length: SN }, () => ({ x: Math.random() * 60, y: .8 + Math.random() * 7, z: Math.random() * 60, p: Math.random() * 6.28, v: .25 + Math.random() * .5 }));
  const sparks = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(sp, 3)),
    new T.PointsMaterial({ map: glowTex, size: .55, color: 0xfff0b0, transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false; scene.add(sparks);
  const wrap = (v, c) => ((v - c + 30) % 60 + 60) % 60 - 30 + c;

  /* ================= 8) แสงอาทิตย์บนท้องฟ้า ================= */
  const sunGlow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: .95 }));
  sunGlow.scale.set(70, 70, 1); sunGlow.renderOrder = -999; sunGlow.frustumCulled = false; scene.add(sunGlow);

  /* ================= 9) โทนสีรวม + vignette (ถูกมาก ไม่ใช้ post-process) ================= */
  canvas.style.filter = CFG.css;
  document.body.appendChild(Object.assign(document.createElement('div'), { id: 'gcvig' }));
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent:
    '#gcvig{position:fixed;inset:0;z-index:2;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,transparent 60%,rgba(25,60,75,.30) 100%),linear-gradient(180deg,rgba(255,236,190,.10),transparent 35%)}' }));

  /* ================= 10) ต่อเข้ากับลูป render ================= */
  const prev = renderer.render.bind(renderer);
  renderer.render = function (s, c) {
    if (s === scene && c === cam) {
      const t = performance.now() / 1000, P = player.position; GU.value = t;
      sun.position.set(P.x + SUNDIR.x * 60, SUNDIR.y * 60, P.z + SUNDIR.z * 60); sun.target.position.set(P.x, 0, P.z); sun.target.updateMatrixWorld();
      for (let i = 0; i < SN; i++) {
        const d = sd[i];
        sp[i * 3] = wrap(d.x + Math.sin(t * d.v + d.p) * 1.2 + t * .25, P.x);
        sp[i * 3 + 1] = d.y + Math.sin(t * d.v * 1.7 + d.p) * .6;
        sp[i * 3 + 2] = wrap(d.z + Math.cos(t * d.v + d.p) * 1.2, P.z);
      }
      sparks.geometry.attributes.position.needsUpdate = true;
      sunGlow.position.copy(cam.position).addScaledVector(SUNDIR, 140);
      const mv = Math.hypot(P.x - lastX, P.z - lastZ) > .002; lastX = P.x; lastZ = P.z;   // ขาแกว่งตอนเดิน
      const lg = player.userData.legG; if (lg) { const sw = mv ? Math.sin(t * 12) * .7 : 0; lg[0].rotation.x = sw; lg[1].rotation.x = -sw; }
      if (t > blinkAt) { blinkK = .14; blinkAt = t + 2.5 + Math.random() * 3; }   // กะพริบตา
      if (blinkK > 0) { blinkK -= 1 / 60; const k = Math.abs(Math.sin(Math.max(0, blinkK) / .14 * Math.PI)); eyes.forEach(e => e.scale.y = Math.max(.08, 1 - k)); }
      else eyes.forEach(e => e.scale.y = 1);
    }
    prev(s, c);
  };

  scan(); setInterval(scan, 1000); // ของที่เกมสร้างทีหลัง (สวน/ของสวมใส่) จะถูกปรับสไตล์ภายใน 1 วินาที
})();