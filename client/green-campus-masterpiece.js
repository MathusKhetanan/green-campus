/* Green Campus — Masterpiece Visual Upgrade */
(() => {
  const T = THREE;
  
  // 1. ปรับโทนสีและแสงสไตล์ Anime (สดใส นุ่มนวล)
  scene.background = new T.Color('#d4f0f9');
  scene.fog = new T.Fog('#d4f0f9', 40, 120);

  // เคลียร์แสงเดิมและจัดแสงใหม่ให้เงาดูมีมิติแบบภาพวาด
  const lights = scene.children.filter(c => c.isLight);
  lights.forEach(l => scene.remove(l));

  const ambientLight = new T.HemisphereLight('#ffffff', '#a8d5ba', 0.85);
  scene.add(ambientLight);

  const mainLight = new T.DirectionalLight('#fff9e6', 1.2);
  mainLight.position.set(30, 50, 20);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 150;
  mainLight.shadow.camera.left = -50;
  mainLight.shadow.camera.right = 50;
  mainLight.shadow.camera.top = 50;
  mainLight.shadow.camera.bottom = -50;
  mainLight.shadow.bias = -0.001;
  scene.add(mainLight);

  // 2. เอฟเฟกต์ใบไม้ปลิว (เพิ่มชีวิตชีวาให้ฉาก)
  const particleCount = 150;
  const particles = new T.BufferGeometry();
  const pPositions = new Float32Array(particleCount * 3);
  const pVelocities = [];

  for (let i = 0; i < particleCount; i++) {
    pPositions[i * 3] = (Math.random() - 0.5) * 80;
    pPositions[i * 3 + 1] = Math.random() * 20 + 5;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    pVelocities.push({
      x: (Math.random() - 0.5) * 0.05,
      y: Math.random() * 0.05 + 0.02,
      z: (Math.random() - 0.5) * 0.05
    });
  }
  particles.setAttribute('position', new T.BufferAttribute(pPositions, 3));

  const leafCanvas = document.createElement('canvas');
  leafCanvas.width = 32; leafCanvas.height = 32;
  const ctx = leafCanvas.getContext('2d');
  ctx.fillStyle = '#8bd1a1';
  ctx.beginPath();
  ctx.arc(16, 16, 12, 0, Math.PI * 2);
  ctx.fill();

  const particleMaterial = new T.PointsMaterial({
    map: new T.CanvasTexture(leafCanvas),
    size: 0.6,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: T.NormalBlending
  });

  const particleSystem = new T.Points(particles, particleMaterial);
  scene.add(particleSystem);

  // 3. ปรับมุมกล้องให้เป็น Isometric
  const originalRender = renderer.render.bind(renderer);
  const targetPos = new T.Vector3();
  
  renderer.render = function (s, c) {
    if (s === scene && c === cam) {
      const cameraOffset = new T.Vector3(-15, 22, 18);
      targetPos.lerp(player.position, 0.1);
      
      cam.position.copy(targetPos).add(cameraOffset);
      cam.lookAt(targetPos.x, targetPos.y + 2, targetPos.z);
      
      const positions = particleSystem.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] -= pVelocities[i].y;
        positions[i * 3] += pVelocities[i].x;
        positions[i * 3 + 2] += pVelocities[i].z;

        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 20;
          positions[i * 3] = player.position.x + (Math.random() - 0.5) * 40;
          positions[i * 3 + 2] = player.position.z + (Math.random() - 0.5) * 40;
        }
      }
      particleSystem.geometry.attributes.position.needsUpdate = true;
    }
    originalRender(s, c);
  };
})();