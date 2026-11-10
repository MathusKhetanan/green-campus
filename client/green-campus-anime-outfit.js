/* Green Campus — Anime Character Outfit Update */
(() => {
  const T = THREE;
  const U = player.userData;
  
  const animeColors = {
    hair: 0x5a3b2a,   
    jacket: 0x2f9e5b, 
    shirt: 0xffffff,  
    tie: 0x2f9e5b,    
    skirt: 0x1a2b22,  
    pants: 0x1a2b22,  
    shoes: 0xffffff   
  };

  const mat = (c) => new T.MeshLambertMaterial({ color: c });

  function applyAnimeOutfit(targetPlayer, isFemale) {
    const jacket = new T.Mesh(
      new T.CylinderGeometry(0.48, 0.52, 1.0, 14, 1, false, Math.PI * 0.15, Math.PI * 1.7), 
      mat(animeColors.jacket)
    );
    jacket.position.y = 1.35; 
    targetPlayer.add(jacket);

    [-1, 1].forEach(s => {
      const sleeve = new T.Mesh(new T.CylinderGeometry(0.18, 0.14, 0.7, 10), mat(animeColors.shirt));
      sleeve.position.set(s * 0.58, 1.6, 0);
      sleeve.rotation.z = s * 0.2;
      targetPlayer.add(sleeve);
    });

    const tie = new T.Mesh(new T.PlaneGeometry(0.15, 0.4), mat(animeColors.tie));
    tie.position.set(0, 1.55, 0.51);
    tie.rotation.x = -0.1;
    targetPlayer.add(tie);

    if (isFemale) {
      const bowG = new T.Group();
      const bowMat = mat(animeColors.jacket);
      const b1 = new T.Mesh(new T.ConeGeometry(0.15, 0.3, 4), bowMat); b1.rotation.z = Math.PI/2; b1.position.x = -0.15;
      const b2 = new T.Mesh(new T.ConeGeometry(0.15, 0.3, 4), bowMat); b2.rotation.z = -Math.PI/2; b2.position.x = 0.15;
      const b3 = new T.Mesh(new T.SphereGeometry(0.08), bowMat);
      bowG.add(b1, b2, b3);
      bowG.position.set(0.4, 2.8, -0.4);
      bowG.rotation.set(0.2, 0.5, -0.3);
      targetPlayer.add(bowG);
      U.hairBow = bowG;
    } else {
      const hpG = new T.Group();
      const hpBand = new T.Mesh(new T.TorusGeometry(0.28, 0.04, 8, 16, Math.PI), mat(0x222222));
      hpBand.rotation.x = Math.PI / 2;
      const hpL = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.08), mat(0xdddddd)); hpL.position.set(-0.28, 0, 0); hpL.rotation.z = Math.PI/2;
      const hpR = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.08), mat(0xdddddd)); hpR.position.set(0.28, 0, 0); hpR.rotation.z = Math.PI/2;
      hpG.add(hpBand, hpL, hpR);
      hpG.position.set(0, 1.85, 0.1);
      targetPlayer.add(hpG);
      U.headphones = hpG;

      const backpack = new T.Mesh(new T.BoxGeometry(0.7, 0.8, 0.3), mat(0x1a2b22));
      backpack.position.set(0, 1.4, -0.6);
      targetPlayer.add(backpack);
      U.backpack = backpack;
    }
  }

  if (typeof sync === 'function') {
    const originalSync = sync;
    sync = function() {
      originalSync(); 
      if (!ME) return;
      const isFemale = ME.user.outfit.gender === 'f';
      
      U.body.material.color.setHex(animeColors.shirt);
      U.hair.material.color.setHex(animeColors.hair);
      if (U.long) U.long.material.color.setHex(animeColors.hair);
      if (U.skirt) U.skirt.material.color.setHex(animeColors.skirt);
      if (U.legs) U.legs.material.color.setHex(animeColors.pants);
      
      if (U.hairBow) U.hairBow.visible = isFemale;
      if (U.headphones) U.headphones.visible = !isFemale;
      if (U.backpack) U.backpack.visible = !isFemale;
    };
  }

  applyAnimeOutfit(player, true); 
  applyAnimeOutfit(player, false);
  if (ME) sync();
})();