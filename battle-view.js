import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';

// The simulation owns normalized coordinates. The renderer alone translates them to 3D.
export function createBattleView(canvas, callbacks) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111a24');
  scene.fog = new THREE.FogExp2('#172230', 0.019);
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 130);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // A soft studio sky gives steel surfaces actual reflected light instead of flat black.
  const skyCanvas=document.createElement('canvas');skyCanvas.width=512;skyCanvas.height=256;
  const skyContext=skyCanvas.getContext('2d'),skyGradient=skyContext.createLinearGradient(0,0,0,256);
  skyGradient.addColorStop(0,'#d4e2ef');skyGradient.addColorStop(.45,'#718396');skyGradient.addColorStop(.55,'#354351');skyGradient.addColorStop(1,'#1b1b22');
  skyContext.fillStyle=skyGradient;skyContext.fillRect(0,0,512,256);
  const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.mapping=THREE.EquirectangularReflectionMapping;skyTexture.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromEquirectangular(skyTexture);scene.environment=environment.texture;scene.environmentIntensity=.65;skyTexture.dispose();pmrem.dispose();
  const hemi = new THREE.HemisphereLight('#c6d7ed', '#303139', 1.5);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight('#d8e7ff', 2.45);
  moon.position.set(-7, 18, 8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: .5, far: 65 });
  moon.shadow.bias = -.0006;
  moon.shadow.normalBias = .025;
  scene.add(moon);
  const rim = new THREE.DirectionalLight('#e79a62', 2);
  rim.position.set(4, 8, -12);
  scene.add(rim);

  const materials = new Map();
  const mat = (color, metalness = 0, roughness = .75) => {
    const key = `${color}-${metalness}-${roughness}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return materials.get(key);
  };
  const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
  const mesh = (parent, geometry, material, pos = [0, 0, 0], scale = null) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (p, color, pos, size, metal = 0) => mesh(p, new THREE.BoxGeometry(...size), mat(color, metal), pos);
  const sphere = (p, color, pos, size, metal = 0) => mesh(p, new THREE.SphereGeometry(1, 12, 10), mat(color, metal), pos, size);
  const cylinder = (p, color, pos, top, bottom, height, segments = 12, metal = 0) => mesh(p, new THREE.CylinderGeometry(top, bottom, height, segments), mat(color, metal), pos);
  const ring = (p, color, radius, width, y = .04, opacity = 1) => {
    const m = mesh(p, new THREE.RingGeometry(radius - width, radius, 80), glow(color, opacity), [0, y, 0]);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    return m;
  };
  const lineBetween = (parent, a, b, color, width = .05, emissive = false) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.clone().sub(from);
    const m = mesh(parent, new THREE.CylinderGeometry(width, width, d.length(), 6), emissive ? glow(color) : mat(color, .45), from.clone().add(to).multiplyScalar(.5).toArray());
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  };
  const world = (x, y) => new THREE.Vector3((x - .5) * 24, 0, (y - .55) * 22);

  // Individual masonry, terraces, buttresses and portcullis form a real 3D courtyard.
  const architecture = new THREE.Group();
  scene.add(architecture);
  cylinder(architecture, '#2b3036', [0, -.72, 0], 13.4, 13.9, 1.4, 12);
  cylinder(architecture, '#4b5056', [0, -.1, 0], 13.45, 13.45, .2, 12);
  const floor = mesh(scene, new THREE.CircleGeometry(13.2, 96), mat('#565960', .07, .92));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = .005;
  floor.receiveShadow = true;
  floor.castShadow = false;
  const tileGeometry = new THREE.BoxGeometry(1.32, .065, 1.32);
  const tileMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .94 });
  const stoneTexture=new THREE.TextureLoader().load('./assets/stone-v3.webp');stoneTexture.colorSpace=THREE.SRGBColorSpace;stoneTexture.wrapS=stoneTexture.wrapT=THREE.RepeatWrapping;stoneTexture.repeat.set(.45,.45);stoneTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());tileMaterial.map=stoneTexture;
  // The same material relief breaks up the perfect grid at grazing camera angles.
  tileMaterial.bumpMap=stoneTexture;tileMaterial.bumpScale=.04;
  const tileCount = [];
  for (let x = -12; x <= 12; x += 1.36) for (let z = -12; z <= 12; z += 1.36) if (Math.hypot(x, z) < 12.8) tileCount.push([x, z]);
  const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, tileCount.length);
  const dummy = new THREE.Object3D();
  tileCount.forEach(([x, z], i) => {
    dummy.position.set(x, -.014, z); dummy.rotation.y = Math.sin(i * 28.7) * .018; dummy.updateMatrix();
    tiles.setMatrixAt(i, dummy.matrix);
    const value = .11 + (Math.sin(i * 19.47) + 1) * .028;
    tiles.setColorAt(i, new THREE.Color(.55+value, .56+value, .57+value));
  });
  tiles.receiveShadow = true;
  architecture.add(tiles);
  for (const r of [3.8, 8.1, 11.8]) ring(architecture, '#b9a17a', r, .035, .033, .46);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const sigil = box(architecture, '#ae9270', [Math.sin(a) * 8.1, .045, Math.cos(a) * 8.1], [.28, .015, .28], .3);
    sigil.rotation.y = a + Math.PI / 4;
  }
  const pillars = [];
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, x = Math.sin(a) * 13.1, z = Math.cos(a) * 13.1;
    if (z > 8.5) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    box(g, '#3e4855', [0, .22, 0], [1.5, .44, 1.5]);
    box(g, '#8b8a80', [0, .5, 0], [1.1, .18, 1.1]);
    box(g, '#56616c', [0, 2.1, 0], [.83, 3.2, .83]);
    for (let h of [1.1, 2.9, 3.7]) box(g, '#92918a', [0, h, 0], [1.05, .14, 1.05]);
    cylinder(g, '#333c47', [0, 4.15, 0], .13, .66, .9, 4);
    const inward = new THREE.Vector3(-x, 0, -z).normalize().multiplyScalar(.7);
    box(g, '#252d36', [inward.x, 2.6, inward.z], [.22, .4, .22], .7);
    cylinder(g, '#ba8545', [inward.x, 2.9, inward.z], .23, .13, .25, 8, .5);
    const flame = mesh(g, new THREE.IcosahedronGeometry(.23, 1), glow('#ffca75'), [inward.x, 3.22, inward.z], [.65, 1.8, .65]);
    const light = new THREE.PointLight('#ffad59', 10, 8, 2); light.position.set(inward.x, 3.2, inward.z); g.add(light);
    pillars.push({ flame, light, seed: i });
    if (i > 0 && i < 6) {
      const prev = (i - 1) * Math.PI / 6;
      lineBetween(architecture, [Math.sin(prev) * 13.1, 1, Math.cos(prev) * 13.1], [x, 1, z], '#434f5b', .3);
    }
  }
  // The fortress gate is tall and sits behind the boss, never in front of the camera.
  const gate = new THREE.Group(); gate.position.set(0, 0, -13.6); scene.add(gate);
  for (let side of [-1, 1]) {
    box(gate, '#303d4d', [side * 4.5, 4.5, 0], [3.6, 9, 2.2]);
    box(gate, '#667180', [side * 3.05, 4, .8], [.45, 8, .7]);
    for (let y = .7; y < 9; y += 1.1) box(gate, '#465463', [side * 4.5, y, 1.17], [3.5, .09, .15]);
    cylinder(gate, '#596575', [side * 4.5, 10, 0], 0, 2.6, 3.5, 4);
    const banner = box(gate, '#67332e', [side * 4.5, 5.2, 1.27], [1.25, 3.3, .08]);
    box(banner, '#d9b476', [0, 0, .06], [.18, 2.2, .03], .5);
    box(banner, '#d9b476', [0, .5, .06], [.65, .16, .03], .5);
  }
  box(gate, '#5a6676', [0, 7, 0], [6, 1.1, 2.3]);
  for (let x = -2.6; x <= 2.6; x += .45) box(gate, '#151d29', [x, 3.2, .1], [.12, 6.4, .16], .75);
  const portal = mesh(gate, new THREE.PlaneGeometry(5.5, 6.6), glow('#be6543', .35), [0, 3.2, -.2]);
  portal.material.color.set('#5d2116'); portal.material.opacity = .65; portal.material.transparent = true;
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4, r = 24 + i % 3 * 5;
    const tower = new THREE.Group(); tower.position.set(Math.sin(a) * r, -6, Math.cos(a) * r); scene.add(tower);
    cylinder(tower, '#243346', [0, 4, 0], 1.3, 2, 15 + i % 4, 6);
    cylinder(tower, '#1b293c', [0, 13, 0], 0, 2.3, 4, 6);
  }

  const colors = ['#568acb', '#a09c94', '#ead7a0', '#6b9f63', '#b44e38', '#6d6385', '#6b9f77', '#947ad5', '#409caa'];
  const armor = mat('#abb8c5', .78, .33), gold = mat('#d4aa58', .65, .34), dark = mat('#253346', .5, .55);
  const models = new THREE.Group(); scene.add(models);
  function humanoid(c, boss = false) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const clothColor = colors[c % 9], isPlate = [0, 1, 8].includes(c) || boss;
    const cloth = mat(clothColor, .06, .88), skin = mat('#bd9b7c', 0, .9);
    const chest = mesh(body, isPlate ? new THREE.IcosahedronGeometry(1,1) : new THREE.SphereGeometry(1,16,14), isPlate ? armor : cloth, [0, 1.43, 0], [.4, .5, .27]);
    // Visible cuirass borders, overlapping faulds, collar and cuffs add silhouette detail.
    if(isPlate){
      for(const side of [-1,1])lineBetween(body,[side*.31,1.74,.19],[side*.22,1.21,.29],'#c4a365',.025);
      for(let n=0;n<3;n++){const plate=box(body,'#647b96',[0,1.02-n*.11,.22],[.59-n*.035,.12,.16],.72);plate.rotation.x=-.1;}
      cylinder(body,'#d9c18c',[0,1.86,0],.18,.24,.12,12,.6);
      box(body,clothColor,[0,1.38,.32],[.16,.42,.055]);
      const emblem=mesh(body,new THREE.OctahedronGeometry(.065),gold,[0,1.53,.37]);emblem.scale.set(1,1.5,.5);
    }else{
      for(const side of [-1,1])lineBetween(body,[side*.08,1.85,.19],[side*.24,.35,.33],'#c9a76a',.018);
      cylinder(body,'#ac8c56',[0,1.7,0],.27,.3,.055,12,.3);
    }
    cylinder(body, '#273346', [0, 1.05, 0], .3, .35, .2, 10);
    box(body, '#aa8d50', [0, 1.09, .3], [.18, .15, .07], .75);
    const head = mesh(body, new THREE.SphereGeometry(.235, 12, 10), skin, [0, 2.03, 0]);
    if (isPlate) {
      mesh(body,new THREE.CylinderGeometry(.23,.27,.43,10),dark,[0,2.09,-.025]);
      box(body,'#9aaec4',[0,2.26,.12],[.39,.075,.21],.75);
      box(body, '#bac7d1', [0, 2.11, .22], [.35, .09, .08], .8);
      box(body, clothColor, [0, 2.07, .27], [.25, .035, .018]);
      box(body, '#c9aa64', [0, 2.21, .25], [.045, .29, .07], .6);
      for (const s of [-1, 1]) {
        const shoulder=mesh(body,new THREE.IcosahedronGeometry(1,1),mat('#8297b1',.75,.36),[s*.44,1.7,0],[.31,.21,.34]);shoulder.rotation.z=s*.16;
        box(body, '#c9aa64', [s * .5, 1.66, .23], [.3, .06, .07], .7);
      }
    } else if (c === 4 || c === 5) {
      mesh(body, new THREE.SphereGeometry(.3, 12, 12, 0, Math.PI * 2, 0, Math.PI * .75), cloth, [0, 2.06, -.05]);
      box(body, '#151d29', [0, 2.08, .23], [.3, .16, .05]);
      for (let s of [-1, 1]) mesh(body, new THREE.SphereGeometry(.025, 6, 6), glow(c === 4 ? '#ffc583' : '#d7eaff'), [s * .073, 2.1, .263]);
    } else {
      sphere(body, c === 6 ? '#d0a367' : '#c7c3ad', [0, 2.16, -.06], [.26, .14, .26]);
      cylinder(body, '#d5b56c', [0, 2.25, 0], .2, .22, .09, 8, .65);
    }
    // An actual mesh cloak, folded panels, leg joints, and shoulder/arm pivots.
    const cape = mesh(body, new THREE.CylinderGeometry(.22, .62, 1.14, 8, 1, true, Math.PI * .15, Math.PI * 1.7), cloth, [0, 1.13, -.16]);
    cape.rotation.x = -.12; cape.material = cloth.clone(); cape.material.side = THREE.DoubleSide;
    if ([2, 3, 4, 7].includes(c)) cylinder(body, clothColor, [0, .71, 0], .31, .53, 1.12, 12);
    const legs = [], arms = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(s * .17, 1, 0); body.add(leg);
      cylinder(leg, '#283443', [0, -.22, 0], .135, .12, .43, 8);
      sphere(leg, isPlate ? '#91a1b5' : '#4c443a', [0, -.47, .02], [.16, .16, .16], .6);
      cylinder(leg, isPlate ? '#879ab1' : '#443d35', [0, -.67, 0], .13, .11, .38, 8, .65);
      box(leg, '#273243', [0, -.9, .1], [.28, .19, .42], .4);if(isPlate){box(leg,'#c4ab73',[0,-.57,.12],[.14,.05,.035],.7);box(leg,'#7a94ac',[0,-.85,.24],[.23,.075,.1],.75);}
      legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(s * .39, 1.63, 0); body.add(arm);
      cylinder(arm, isPlate ? '#869cb6' : clothColor, [s * .07, -.2, 0], .12, .14, .4, 8, .5);
      sphere(arm, '#aa9069', [s * .1, -.43, .03], [.12, .12, .12], .3);
      cylinder(arm, isPlate ? '#97a7ba' : '#473f3b', [s * .1, -.57, .07], .115, .1, .27, 8, .5);
      mesh(arm, new THREE.SphereGeometry(.11, 8, 8), skin, [s * .1, -.73, .1]);
      arms.push(arm);
    }
    const sword = (parent, small = false) => {
      const weapon = new THREE.Group(); parent.add(weapon); weapon.position.set(.12, -.67, .15);
      const size = small ? .65 : 1;
      box(weapon, '#33302e', [0, -.11, 0], [.08, .28, .09]);
      box(weapon, '#d4af6b', [0, .06, 0], [.42, .08, .1], .8);
      const blade = cylinder(weapon, '#b8d2e0', [0, .64 * size, 0], 0, .115, 1.12 * size, 4, .85); blade.rotation.y = Math.PI / 4;
      lineBetween(weapon, [0, .15, .08], [0, 1.1 * size, .08], c === 8 ? '#66d9e9' : '#dceafa', .018, true);
      return weapon;
    };
    if (c === 0 || boss) {
      const shield = new THREE.Group(); arms[0].add(shield); shield.position.set(-.12, -.5, .27);
      const shape = new THREE.Shape(); shape.moveTo(-.34, .43); shape.lineTo(.34, .43); shape.lineTo(.37, -.12); shape.lineTo(0, -.61); shape.lineTo(-.37, -.12); shape.closePath();
      mesh(shield, new THREE.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .03, bevelThickness: .03 }), mat('#41638b', .6, .36));
      box(shield, '#dec17a', [0, 0, .16], [.07, .83, .04], .7);
      box(shield, '#dec17a', [0, .18, .16], [.53, .07, .04], .7);
      sword(arms[1]);
    } else if (c === 1) {
      cylinder(arms[1], '#6c5041', [.12, -.02, .13], .06, .06, 1.3, 8);
      const axe = mesh(arms[1], new THREE.CylinderGeometry(.32, .32, .09, 6, 1, false, 0, Math.PI), armor, [.12, .57, .13]); axe.rotation.z = Math.PI / 2;
    } else if (c === 5) { sword(arms[0], true); sword(arms[1], true); }
    else if (c === 8) sword(arms[1]);
    else if (c === 6) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -.55, .1), new THREE.Vector3(-.2, 0, .1), new THREE.Vector3(0, .55, .1)]);
      mesh(arms[0], new THREE.TubeGeometry(curve, 16, .045, 6, false), mat('#a07c4b', .15), [-.1, -.3, .12]);
      lineBetween(arms[0], [-.1, -.85, .22], [-.1, .25, .22], '#d4cca9', .012);
    } else {
      const staffColor = c === 2 ? '#f6db91' : c === 3 ? '#98ebae' : c === 4 ? '#ff9453' : '#c5a5ff';
      cylinder(arms[1], '#93774e', [.15, -.08, .12], .055, .055, 1.8, 8, .4);
      const gem = mesh(arms[1], new THREE.OctahedronGeometry(.2), glow(staffColor), [.15, .96, .12]);
      mesh(arms[1], new THREE.TorusGeometry(.25, .035, 6, 12), gold, [.15, .96, .12]);
      root.userData.gem = gem;
    }
    if (c === 3) for (const s of [-1, 1]) {
      lineBetween(body, [s * .15, 2.22, 0], [s * .45, 2.56, -.1], '#8a7453', .035);
      lineBetween(body, [s * .3, 2.4, -.05], [s * .27, 2.64, -.1], '#8a7453', .028);
    }
    root.userData = { ...root.userData, body, chest, head, cape, legs, arms, classId: c };
    return root;
  }

  function makeBoss(type) {
    let boss;
    if(type===0 && characterAssets.has('Knight')){
      boss=authoredHero(0);boss.scale.setScalar(2.5);
      boss.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.set('#9c8794');o.material.metalness=.35;o.material.roughness=.55;}});
      const hammerHand=boss.getObjectByName('handslot.r');
      if(hammerHand){box(hammerHand,'#403847',[0,.55,0],[.8,.4,.45],.8);box(hammerHand,'#ed9957',[0,.56,.24],[.44,.16,.04],.5);}
      for(const side of [-1,1]){const horn=cylinder(boss,'#ceac82',[side*.25,2.28,-.02],0,.09,.43,8,.3);horn.rotation.z=-side*.65;}
      boss.userData.body=boss.userData.rig;boss.userData.arms=[];
      return boss;
    }
    if (type === 0) {
      boss = humanoid(1, true); boss.scale.setScalar(2.45);
      boss.traverse(o => { if (o.isMesh && o.material === armor) o.material = mat('#625564', .85, .4); });
      const body = boss.userData.body;
      for (let s of [-1, 1]) {
        const horn = cylinder(body, '#c09c70', [s * .24, 2.4, -.05], 0, .13, .55, 8, .2); horn.rotation.z = -s * .55;
        for (let i = 0; i < 3; i++) {
          const spike = cylinder(body, '#aeb3ba', [s * (.46 + i * .08), 1.88, -.05 + i * .12], 0, .1, .35, 6, .6); spike.rotation.z = -s * .6;
        }
        mesh(body, new THREE.SphereGeometry(.07, 8, 8), glow('#ff9b48'), [s * .1, 2.1, .28]);
      }
      lineBetween(body, [-.2, 1.8, .26], [.15, 1.28, .29], '#ffad50', .026, true);
      lineBetween(body, [.2, 1.73, .25], [-.1, 1.36, .3], '#fa663b', .025, true);
      const hammer = boss.userData.arms[1];
      box(hammer, '#554958', [.12, .65, .13], [.9, .46, .5], .85);
      box(hammer, '#e4a260', [.12, .66, .37], [.34, .17, .03], .5);
    } else if (type === 1) {
      boss = humanoid(3); boss.scale.setScalar(2.2);
      boss.userData.body.children.forEach(o => { if (o.material && o.material.color?.getHexString() === '6b9f63') o.material = mat('#365b42', .2); });
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const spike = cylinder(boss.userData.body, '#724a83', [Math.sin(a) * .3, 2.45, Math.cos(a) * .3], 0, .08, .48, 6); spike.rotation.z = Math.sin(a) * -.4;
      }
    } else {
      boss = new THREE.Group(); const body = new THREE.Group(); boss.add(body);
      const core = mesh(body, new THREE.IcosahedronGeometry(1.45, 1), mat('#3b305a', .7, .35), [0, 3, 0], [1, 1.2, .7]);
      const eye = mesh(body, new THREE.SphereGeometry(.53, 20, 14), glow('#cdb0ff'), [0, 3.1, 1.05], [1, .7, .35]);
      sphere(body, '#2e174f', [0, 3.1, 1.24], [.1, .35, .05]);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const spike = cylinder(body, '#695485', [Math.sin(a) * 1.7, 3 + Math.cos(a) * 1.6, 0], 0, .23, 1, 6, .5); spike.rotation.z = -a;
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(Math.sin(a), 2, 0), new THREE.Vector3(Math.sin(a) * 2, 1, -.4), new THREE.Vector3(Math.sin(a) * 1.3, .2, 1)]);
        mesh(body, new THREE.TubeGeometry(curve, 12, .13, 6, false), mat('#574576', .5));
      }
      boss.userData = { body, chest: core, head: eye, legs: [], arms: [], cape: core, classId: 11 };
    }
    return boss;
  }
  const characterAssets=new Map(), loader=new GLTFLoader();
  const modelNames=['Knight','Barbarian','Mage','Mage','Mage','Rogue','Rogue','Mage','Knight'];
  const loading=Promise.all(['Knight','Barbarian','Mage','Rogue'].map(name=>loader.loadAsync('./assets/models/'+name+'.glb').then(asset=>characterAssets.set(name,asset))));
  loading.catch(error=>console.error('Character models could not be loaded',error));
  function authoredHero(c) {
    const asset=characterAssets.get(modelNames[c]);
    if(!asset)return null;
    const root=new THREE.Group(), rig=cloneSkeleton(asset.scene);root.add(rig);
    const accessories=new Set(c===0?['1H_Sword','Rectangle_Shield']:c===1?['2H_Axe']:c===5?['Knife','Knife_Offhand']:c===6?['2H_Crossbow']:c===8?['2H_Sword']:['2H_Staff']);
    rig.traverse(o=>{
      if(!o.isMesh)return;
      o.visible=/^(Knight|Mage|Rogue|Barbarian)_/.test(o.name)||accessories.has(o.name);
      o.castShadow=true;o.receiveShadow=true;
      o.material=o.material.clone();o.material.envMapIntensity=.6;
      if(modelNames[c]==='Mage'){
        const tint=new THREE.Color(colors[c]);
        o.material.onBeforeCompile=shader=>{
          shader.uniforms.robeTint={value:tint};
          shader.fragmentShader='uniform vec3 robeTint;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            if(diffuseColor.b>diffuseColor.r*1.15 || (diffuseColor.r>diffuseColor.g*1.9 && diffuseColor.r>diffuseColor.b*1.5)) {
              float luminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              diffuseColor.rgb=robeTint*(.6+luminance*.6);
            }`);
        };
        o.material.customProgramCacheKey=()=>String(c);
      }
    });
    rig.updateMatrixWorld(true);const bounds=new THREE.Box3();
    rig.traverse(o=>{if(o.isMesh&&o.visible){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))}});
    const scale=2.35/(bounds.max.y-bounds.min.y);rig.scale.setScalar(scale);rig.position.y=-bounds.min.y*scale;
    const mixer=new THREE.AnimationMixer(rig),actions={};
    for(const clip of asset.animations)actions[clip.name]=mixer.clipAction(clip);
    actions.Idle?.play();
    root.userData={classId:c,authored:true,mixer,actions,actionName:'Idle',rig};
    return root;
  }
  const units = [], labelHost = document.querySelector('#world-labels');
  const heroNames = ['카엘', '엘리아', '이그니스', '레온', '실바'];
  const heroLabels = heroNames.map((name, i) => {
    const el = document.createElement('button'); el.className = 'world-label'; el.dataset.hero = i; el.innerHTML = `<span class="world-name"><b>${i + 1}</b>${name}</span><span class="world-hp"><i></i></span><span class="world-debuff"></span>`;
    el.onclick = () => callbacks.select(i); labelHost.appendChild(el); return el;
  });
  let boss, bossType = -1, lastSelected = -1, currentState, lastWidth = 0, lastHeight = 0;
  const bossRing = new THREE.Group(); ring(bossRing, '#d99a66', 1.8, .045, .07, .7); scene.add(bossRing);
  const selectRing = new THREE.Group(); ring(selectRing, '#f1d196', .77, .05); ring(selectRing, '#f1d196', .88, .012, .045, .5); scene.add(selectRing);
  const moveMarker = new THREE.Group(); ring(moveMarker, '#d8efbb', .4, .05); scene.add(moveMarker); moveMarker.visible = false;
  const hazards = new Map(), addModels = [], castHalo = new THREE.Group(); scene.add(castHalo); ring(castHalo, '#f8844b', 2.4, .09, .045);
  const shields = [];
  for (let i = 0; i < 5; i++) {
    const bubble = mesh(scene, new THREE.SphereGeometry(1.25, 16, 12), new THREE.MeshBasicMaterial({ color: '#96c5ee', wireframe: true, transparent: true, opacity: .17, depthWrite: false }));
    shields.push(bubble);
  }
  const projectiles = [];
  for (let i = 0; i < 5; i++) {
    const p = mesh(scene, new THREE.SphereGeometry(.095, 8, 8), glow(i === 1 ? '#b3f3ac' : i === 2 ? '#ffab61' : '#eddbb1'));
    p.visible = false; projectiles.push(p);
  }
  const motes = new THREE.BufferGeometry(), positions = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) { positions[i * 3] = Math.sin(i * 3.17) * 12; positions[i * 3 + 1] = (i % 12) * .45 + .2; positions[i * 3 + 2] = Math.cos(i * 2.17) * 12; }
  motes.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(motes, new THREE.PointsMaterial({ color: '#e3b985', size: .035, transparent: true, opacity: .6, depthWrite: false })); scene.add(particles);

  let yaw = .55, elevation = .69, distance = 21, overview = false, pointerDown = null, dragging = false;
  const target = new THREE.Vector3(0, 1, 0), goal = new THREE.Vector3(), desiredPosition = new THREE.Vector3();
  camera.position.set(13, 18, 20); camera.lookAt(target);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    pointerDown = { x: e.clientX, y: e.clientY, button: e.button }; dragging = false;
    if (e.button === 2) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointerDown || pointerDown.button !== 2) return;
    yaw -= (e.clientX - pointerDown.x) * .005;
    elevation = THREE.MathUtils.clamp(elevation + (e.clientY - pointerDown.y) * .003, .4, 1.13);
    pointerDown.x = e.clientX; pointerDown.y = e.clientY; dragging = true;
  });
  canvas.addEventListener('pointerup', e => {
    if (e.button === 0 && pointerDown && !dragging) pick(e.clientX, e.clientY);
    pointerDown = null; dragging = false;
  });
  canvas.addEventListener('pointercancel', () => { pointerDown = null; dragging = false; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); distance = THREE.MathUtils.clamp(distance + e.deltaY * .015, 12, 34); }, { passive: false });
  function pick(clientX, clientY) {
    if (!currentState) return;
    const rect = canvas.getBoundingClientRect();
    ndc.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(units, true)[0];
    if (hit) { let o = hit.object; while (o && o.userData.hero === undefined) o = o.parent; if (o) { callbacks.select(o.userData.hero); return; } }
    const point = ray.intersectObject(floor)[0]?.point;
    if (point) { const x = THREE.MathUtils.clamp(point.x / 24 + .5, .13, .87), y = THREE.MathUtils.clamp(point.z / 22 + .55, .39, .85); callbacks.move(x, y); moveMarker.position.copy(world(x, y)); moveMarker.visible = true; }
  }
  function setOverview(value) { overview = value; callbacks.cameraMode?.(overview); }
  document.querySelector('#camera-mode').onclick = () => setOverview(!overview);
  document.querySelector('#camera-reset').onclick = () => { yaw = .55; elevation = .69; distance = 21; setOverview(false); };
  function disposeModel(model) {
    model.traverse(o => { if (o.isMesh) { if(!model.userData.authored)o.geometry.dispose(); if (!Array.isArray(o.material) && ![...materials.values()].includes(o.material) && o.material !== armor && o.material !== gold && o.material !== dark) o.material.dispose(); } });
    model.parent?.remove(model);
  }
  function updateUnits(state, dt, clock) {
    state.party.forEach((p, i) => {
      if (!units[i] || units[i].userData.classId !== p.c || (!units[i].userData.authored&&characterAssets.has(modelNames[p.c]))) {
        if (units[i]) disposeModel(units[i]);
        units[i] = authoredHero(p.c)||humanoid(p.c); units[i].userData.hero = i; models.add(units[i]);
      }
      const unit = units[i], data = unit.userData, pos = world(p.x, p.y), moving = Math.hypot(p.x - p.tx, p.y - p.ty) > .012;
      unit.position.copy(pos); unit.visible = p.hp > 0 || data.authored;
      const direction = world(moving ? p.tx : .5, moving ? p.ty : .32).sub(pos);
      let angle = Math.atan2(direction.x, direction.z), diff = THREE.MathUtils.euclideanModulo(angle - unit.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      unit.rotation.y += diff * Math.min(1, dt * 8);
      if(data.authored){
        const animation=p.hp<=0?'Death_A':moving?'Walking_A':state.running?(p.c===2||p.c===3||p.c===4||p.c===7?'Spellcasting':p.c===6?'2H_Ranged_Shooting':p.c===5?'Dualwield_Melee_Attack_Slice':'1H_Melee_Attack_Chop'):'Idle';
        if(animation!==data.actionName&&data.actions[animation]){
          const previous=data.actions[data.actionName],next=data.actions[animation];
          previous?.fadeOut(.18);next.reset().fadeIn(.18).play();
          if(animation==='Death_A'){next.setLoop(THREE.LoopOnce,1);next.clampWhenFinished=true;}
          data.actionName=animation;
        }
        if(!state.paused)data.mixer.update(dt*(state.running?1.2:1));
      }else{
      const step = moving ? Math.sin(clock * 10 + i) : Math.sin(clock * 1.5 + i) * .06;
      data.body.position.y = moving ? Math.abs(step) * .08 : Math.sin(clock * 2 + i) * .025;
      data.legs[0].rotation.x = step * .5; data.legs[1].rotation.x = -step * .5;
      const attack = state.running && !state.paused ? Math.sin(state.time * 4 + i * 1.4) : 0;
      data.arms[0].rotation.x = moving ? -step * .3 : attack * .12;
      data.arms[1].rotation.x = moving ? step * .3 : Math.min(0, attack) * .8;
      data.cape.rotation.x = -.12 + Math.sin(clock * 2.5 + i) * .08;
      if (data.gem) data.gem.rotation.y = clock;
      }
      shields[i].visible = state.shield > 0 && p.hp > 0; shields[i].position.copy(pos).y = 1.1;
      const label = heroLabels[i], hpRatio = p.hp / state.classes[p.c].hp;
      label.querySelector('i').style.width = `${Math.max(0, hpRatio * 100)}%`;
      label.querySelector('.world-debuff').textContent = p.debuff > 0 ? '저주 · W 해제' : '';
      label.classList.toggle('chosen', state.selected === i); label.classList.toggle('dead', p.hp <= 0);
      const projected = pos.clone().add(new THREE.Vector3(0, 2.75, 0)).project(camera);
      const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < .95;
      label.style.display = visible ? 'block' : 'none'; label.style.left = `${(projected.x * .5 + .5) * lastWidth}px`; label.style.top = `${(-projected.y * .5 + .5) * lastHeight}px`;
      const proj = projectiles[i]; proj.visible = state.running && !state.paused && p.hp > 0 && p.c !== 0 && p.c !== 1 && p.c !== 5 && p.c !== 8;
      if (proj.visible) {
        const end = i === 1 ? world(state.party[0].x, state.party[0].y).add(new THREE.Vector3(0, 1.4, 0)) : world(state.adds.length ? state.adds[0].x : .5, state.adds.length ? state.adds[0].y : .32).add(new THREE.Vector3(0, state.adds.length ? 1 : 2.3, 0));
        const t = (state.time * 1.2 + i * .27) % 1;
        proj.position.copy(pos).y = 1.6; proj.position.lerp(end, t); proj.position.y += Math.sin(t * Math.PI) * .6;
        proj.scale.setScalar(state.buff > 0 ? 1.65 : 1);
      }
    });
    if (lastSelected !== state.selected) { lastSelected = state.selected; setOverview(false); }
    selectRing.position.copy(world(state.party[state.selected].x, state.party[state.selected].y));
    selectRing.visible = state.party[state.selected].hp > 0;
    selectRing.rotation.y = clock * .25;
    if (moveMarker.visible && world(state.party[state.selected].x, state.party[state.selected].y).distanceTo(moveMarker.position) < .2) moveMarker.visible = false;
    if (bossType !== state.bi || (bossType===0&&!boss?.userData.authored&&characterAssets.has('Knight'))) { if (boss) disposeModel(boss); bossType = state.bi; boss = makeBoss(bossType); models.add(boss); }
    boss.position.copy(world(.5, .32)); boss.rotation.y = Math.atan2(state.party[0].x - .5, state.party[0].y - .32);
    boss.userData.body.position.y = Math.sin(clock * 1.3) * .045;
    if (bossType === 2) boss.userData.body.position.y += Math.sin(clock * 1.5) * .13;
    if(boss.userData.authored){const action=state.running?'1H_Melee_Attack_Chop':'Idle';if(action!==boss.userData.actionName){boss.userData.actions[boss.userData.actionName]?.fadeOut(.2);boss.userData.actions[action]?.reset().fadeIn(.2).play();boss.userData.actionName=action;}if(!state.paused)boss.userData.mixer.update(dt*.65);}
    if (boss.userData.arms.length) boss.userData.arms[1].rotation.x = state.cast ? -.9 : state.running ? Math.min(0, Math.sin(state.time * 2)) * .5 : 0;
    boss.visible = state.bhp > 0; bossRing.position.copy(boss.position); bossRing.visible = boss.visible;
    castHalo.position.copy(boss.position); castHalo.visible = !!state.cast;
    if (state.cast) castHalo.scale.setScalar(1 + .12 * Math.sin(clock * 12));
    for (const [z, g] of hazards) if (!state.zones.includes(z)) { g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); scene.remove(g); hazards.delete(z); }
    for (const z of state.zones) {
      let g = hazards.get(z);
      if (!g) {
        g = new THREE.Group(); g.position.copy(world(z.x, z.y));
        const disk = mesh(g, new THREE.CircleGeometry(z.r * 24, 64), glow('#e65032', .25), [0, .07, 0]); disk.rotation.x = -Math.PI / 2; disk.castShadow = false;
        ring(g, '#ff7958', z.r * 24, .08, .08);
        const progress = ring(g, '#ffd0a7', z.r * 24, .05, .085); g.userData.progress = progress;
        hazards.set(z, g); scene.add(g);
      }
      g.userData.progress.scale.setScalar(Math.max(.01, 1 - z.t / z.max));
    }
    while (addModels.length > state.adds.length) disposeModel(addModels.pop());
    state.adds.forEach((a, i) => {
      if (!addModels[i]) { const g = humanoid(5); g.scale.setScalar(.8); g.traverse(o => { if (o.isMesh) o.material = mat('#7f728b', .2, .8); }); models.add(g); addModels.push(g); }
      addModels[i].position.copy(world(a.x, a.y)); addModels[i].rotation.y = Math.PI; addModels[i].position.y = Math.sin(clock * 3 + i) * .06;
    });
  }
  let lastNow = performance.now();
  function draw(state) {
    currentState = state;
    const now = performance.now(), dt = Math.min(.1, (now - lastNow) / 1000); lastNow = now;
    const rect = canvas.getBoundingClientRect();
    if (rect.width !== lastWidth || rect.height !== lastHeight) {
      lastWidth = rect.width; lastHeight = rect.height; renderer.setSize(lastWidth, lastHeight, false); camera.aspect = lastWidth / lastHeight; camera.updateProjectionMatrix();
    }
    const focus = world(state.party[state.selected].x, state.party[state.selected].y), bossPos = world(.5, .32);
    goal.copy(overview ? new THREE.Vector3(0, 1, -.4) : focus.clone().lerp(bossPos, .42).add(new THREE.Vector3(0, 1, 0)));
    target.lerp(goal, 1 - Math.exp(-dt * 4));
    const cameraDistance = overview ? 29 : distance;
    desiredPosition.set(Math.sin(yaw) * Math.cos(elevation) * cameraDistance, Math.sin(elevation) * cameraDistance, Math.cos(yaw) * Math.cos(elevation) * cameraDistance).add(target);
    camera.position.lerp(desiredPosition, 1 - Math.exp(-dt * 4)); camera.lookAt(target);
    const clock = state.paused ? state.time : state.running ? state.time : now / 1000;
    updateUnits(state, dt, clock);
    pillars.forEach(({ flame, light, seed }) => { flame.scale.y = 1.7 + Math.sin(clock * 8 + seed) * .3; light.intensity = 10 + Math.sin(clock * 7 + seed) * 1.2; });
    particles.rotation.y = clock * .012;
    renderer.render(scene, camera);
  }
  const hud = document.querySelector('#camera-follow');
  const originalDraw = draw;
  return {
    draw(state) { hud.textContent = overview ? '성채 전경 · 전체 보기' : `${heroNames[state.selected]} 시점 · ${state.classes[state.party[state.selected].c].name}`; originalDraw(state); },
    moveDirection(dx,dy) { return {x:dx*Math.cos(yaw)+dy*Math.sin(yaw),y:-dx*Math.sin(yaw)+dy*Math.cos(yaw)}; },
    center() { yaw = .55; elevation = .69; distance = 21; setOverview(false); },
    // Read-only diagnostics used by browser smoke tests.
    inspect() { return { hero: lastSelected, overview, camera: camera.position.toArray(), target: target.toArray(), renderer: 'Three.js', revision: THREE.REVISION, models: units.length, authoredModels:units.filter(u=>u.userData.authored).length, modelAssets:characterAssets.size, hazards: hazards.size }; },
    screenPosition(i) { const p = units[i].position.clone().add(new THREE.Vector3(0, 1.2, 0)).project(camera); return { x: (p.x * .5 + .5) * lastWidth, y: (-p.y * .5 + .5) * lastHeight }; }
  };
}
