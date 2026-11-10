/* Green Campus — Anime Character Full Stylizer (Chibi 3D Model) */
(() => {
  const T = THREE;
  const playerGroup = player;

  // ล้างส่วนหัวและตัวเดิมออกเพื่อสร้างใหม่ให้เป็นสไตล์อนิเมะ
  while(playerGroup.children.length > 0){ 
    playerGroup.remove(playerGroup.children[0]); 
  }

  const mat = (color, roughness = 0.5) => new T.MeshStandardMaterial({ color, roughness });
  const skinMat = mat(0xffdcbb);
  const hairMat = mat(0x5a3b2a); // ผมสีน้ำตาลเข้ม
  const shirtMat = mat(0xffffff); // เสื้อเชิ้ตขาว
  const jacketMat = mat(0x2f9e5b); // แจ็คเก็ตเขียว
  const skirtMat = mat(0x1a2b22); // กระโปรง/กางเกงเขียวเข้ม
  const shoeMat = mat(0xffffff); // รองเท้าผ้าใบขาว

  // 1. ส่วนหัว (หัวโตสไตล์อนิเมะ Chibi)
  const headGroup = new T.Group();
  headGroup.position.y = 2.3;
  
  const headMesh = new T.Mesh(new T.SphereGeometry(0.55, 32, 32), skinMat);
  headMesh.scale.set(1, 0.9, 0.95);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // ดวงตากลมโตสไตล์อนิเมะ
  [-1, 1].forEach(s => {
    const eyeBase = new T.Mesh(new T.PlaneGeometry(0.18, 0.22), mat(0xffffff));
    eyeBase.position.set(s * 0.18, 0.05, 0.48);
    
    // ลูกตาด้านใน
    const pupil = new T.Mesh(new T.PlaneGeometry(0.12, 0.16), mat(0x2f9e5b));
    pupil.position.set(s * 0.18, 0.04, 0.49);
    
    // ประกายตา
    const sparkle = new T.Mesh(new T.PlaneGeometry(0.05, 0.05), mat(0xffffff));
    sparkle.position.set(s * 0.15 + (s * 0.02), 0.08, 0.50);

    headGroup.add(eyeBase, pupil, sparkle);
  });

  // ผมด้านหลังและด้านข้าง (ทรงผมยาวลอน)
  const backHair = new T.Mesh(new T.SphereGeometry(0.62, 16, 16), hairMat);
  backHair.position.set(0, 0, -0.1);
  backHair.scale.set(1.05, 1.1, 1.1);
  headGroup.add(backHair);

  // ผมหน้าม้า
  const bangs = new T.Mesh(new T.CylinderGeometry(0.58, 0.58, 0.4, 16, 1, false, 0, Math.PI), hairMat);
  bangs.position.set(0, 0.2, 0.1);
  bangs.rotation.x = 0.2;
  headGroup.add(bangs);

  // โบว์ผูกผมสีเขียว
  const bowGroup = new T.Group();
  const bowWingL = new T.Mesh(new T.ConeGeometry(0.15, 0.3, 4), jacketMat);
  bowWingL.rotation.z = Math.PI / 2; bowWingL.position.x = -0.12;
  const bowWingR = new T.Mesh(new T.ConeGeometry(0.15, 0.3, 4), jacketMat);
  bowWingR.rotation.z = -Math.PI / 2; bowWingR.position.x = 0.12;
  bowGroup.add(bowWingL, bowWingR);
  bowGroup.position.set(0.4, 0.4, -0.4);
  bowGroup.rotation.set(0.2, 0.5, -0.3);
  headGroup.add(bowGroup);

  playerGroup.add(headGroup);

  // 2. ส่วนลำตัวและเสื้อผ้า
  const bodyGroup = new T.Group();
  bodyGroup.position.y = 1.35;

  // ลำตัวเสื้อเชิ้ต + แจ็คเก็ต
  const torso = new T.Mesh(new T.CylinderGeometry(0.35, 0.42, 1.0, 16), shirtMat);
  torso.castShadow = true;
  bodyGroup.add(torso);

  const jacket = new T.Mesh(new T.CylinderGeometry(0.38, 0.46, 0.95, 16, 1, false, 0.3, Math.PI * 1.4), jacketMat);
  bodyGroup.add(jacket);

  // เนคไท
  const tie = new T.Mesh(new T.BoxGeometry(0.1, 0.35, 0.04), jacketMat);
  tie.position.set(0, 0.25, 0.38);
  bodyGroup.add(tie);

  // แขนเสื้อ
  const armGeo = new T.CylinderGeometry(0.12, 0.1, 0.7, 10);
  const leftArm = new T.Mesh(armGeo, jacketMat); leftArm.position.set(-0.45, 0.1, 0); leftArm.rotation.z = 0.2;
  const rightArm = new T.Mesh(armGeo, jacketMat); rightArm.position.set(0.45, 0.1, 0); rightArm.rotation.z = -0.2;
  bodyGroup.add(leftArm, rightArm);

  // กระโปรงจีบ
  const skirt = new T.Mesh(new T.CylinderGeometry(0.42, 0.65, 0.45, 16), skirtMat);
  skirt.position.set(0, -0.6, 0);
  bodyGroup.add(skirt);

  playerGroup.add(bodyGroup);

  // 3. ส่วนขาและรองเท้า
  const legGroup = new T.Group();
  legGroup.position.y = 0.5;
  const legGeo = new T.CylinderGeometry(0.1, 0.09, 0.6, 10);
  const leftLeg = new T.Mesh(legGeo, skinMat); leftLeg.position.set(-0.18, -0.3, 0);
  const rightLeg = new T.Mesh(legGeo, skinMat); rightLeg.position.set(0.18, -0.3, 0);

  const shoeGeo = new T.BoxGeometry(0.16, 0.16, 0.28);
  const leftShoe = new T.Mesh(shoeGeo, shoeMat); leftShoe.position.set(-0.18, -0.65, 0.05);
  const rightShoe = new T.Mesh(shoeGeo, shoeMat); rightShoe.position.set(0.18, -0.65, 0.05);

  legGroup.add(leftLeg, rightLeg, leftShoe, rightShoe);
  playerGroup.add(legGroup);

  // ผูก userData เผื่อระบบเดิมเรียกใช้
  player.userData = {
    body: torso,
    legs: skirt,
    hair: backHair,
    tail: { visible: false }
  };

  console.log("Anime Master Model Loaded Successfully!");
})();