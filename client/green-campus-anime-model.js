/* Green Campus — Anime Character Model Sync (ตามภาพอ้างอิง) */
(() => {
  const T = THREE;
  
  // สีและสไตล์อิงจากอาร์ตเวิร์ค (ตัวละครหญิง: ผมน้ำตาล, เสื้อขาว, แจ็คเก็ตเขียว #2f9e5b, กระโปรงจีบเขียวเข้ม)
  const colors = {
    hair: 0x5a3b2a,
    jacket: 0x2f9e5b,
    innerShirt: 0xffffff,
    skirt: 0x1a3322,
    tie: 0x2f9e5b,
    shoes: 0xffffff
  };

  const createAnimeMesh = () => {
    const group = new T.Group();
    const mat = (c) => new T.MeshLambertMaterial({ color: c });

    // หัวตัวละคร (สัดส่วนอนิเมะหัวโตหน้าหวาน)
    const head = new T.Mesh(new T.SphereGeometry(0.55, 32, 32), mat(0xffdcbb));
    head.position.y = 2.4;
    head.scale.set(1, 0.9, 0.95);
    group.add(head);

    // ทรงผมลอนยาวสีน้ำตาล (สร้างจากทรงกลมกลุ่มซ้อนกันให้พริ้วไหว)
    const hair = new T.Mesh(new T.SphereGeometry(0.62, 16, 16), mat(colors.hair));
    hair.position.set(0, 2.48, -0.05);
    hair.scale.set(1.1, 1.2, 1.15);
    group.add(hair);

    // โบว์สีเขียวประดับผมด้านข้าง
    const bowGroup = new T.Group();
    const bowMat = mat(colors.jacket);
    const b1 = new T.Mesh(new T.ConeGeometry(0.14, 0.28, 4), bowMat); b1.rotation.z = Math.PI / 2; b1.position.x = -0.12;
    const b2 = new T.Mesh(new T.ConeGeometry(0.14, 0.28, 4), bowMat); b2.rotation.z = -Math.PI / 2; b2.position.x = 0.12;
    bowGroup.add(b1, b2);
    bowGroup.position.set(0.42, 2.85, -0.35);
    bowGroup.rotation.set(0.2, 0.6, -0.3);
    group.add(bowGroup);

    // ลำตัว (ชุดนักเรียน + แจ็คเก็ตเขียวสไตล์สตรีท)
    const torso = new T.Mesh(new T.CylinderGeometry(0.38, 0.44, 1.0, 16), mat(colors.innerShirt));
    torso.position.y = 1.35;
    group.add(torso);

    // แจ็คเก็ตคลุมไหล่สีเขียว-ขาว
    const jacket = new T.Mesh(new T.CylinderGeometry(0.42, 0.48, 0.95, 16, 1, false, 0.2, Math.PI * 1.4), mat(colors.jacket));
    jacket.position.y = 1.35;
    group.add(jacket);

    // เนคไทสีเขียว
    const tie = new T.Mesh(new T.BoxGeometry(0.12, 0.35, 0.04), mat(colors.tie));
    tie.position.set(0, 1.52, 0.42);
    group.add(tie);

    // กระโปรงจีบสีเขียวเข้ม
    const skirt = new T.Mesh(new T.CylinderGeometry(0.44, 0.75, 0.5, 16), mat(colors.skirt));
    skirt.position.y = 0.8;
    group.add(skirt);

    // ขาและรองเท้าผ้าใบสีขาว
    [-0.18, 0.18].forEach(x => {
      const leg = new T.Mesh(new T.CylinderGeometry(0.09, 0.08, 0.7, 10), mat(0xffdcbb));
      leg.position.set(x, 0.4, 0);
      const shoe = new T.Mesh(new T.BoxGeometry(0.16, 0.15, 0.3), mat(colors.shoes));
      shoe.position.set(x, 0.05, 0.05);
      group.add(leg, shoe);
    });

    return group;
  };

  // แทนที่ตัวละครเดิมด้วยโมเดลสไตล์อนิเมะ
  if (typeof player !== 'undefined' && player) {
    while (player.children.length > 0) {
      player.remove(player.children[0]);
    }
    const animeModel = createAnimeMesh();
    player.add(animeModel);
    
    // อัปเดตข้อมูลโครงสร้างเชื่อมโยงระบบเกมเดิม
    player.userData = {
      body: animeModel.children[3],
      legs: animeModel.children[6],
      hair: animeModel.children[1],
      tail: { visible: false }
    };
  }
  
  console.log("Anime Character Model Loaded Successfully!");
})();