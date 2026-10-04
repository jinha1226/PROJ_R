import * as THREE from 'three';

/** The armour pieces' materials: shell and plates take hit flashes; `lights` are the engraving lamps on the backpack. */
export interface SuitParts { mats: THREE.MeshStandardMaterial[]; lights: THREE.MeshStandardMaterial[] }

export const SUIT_SLOTS = 6;
const GLOW = '#5fe0ff';
const LAMP_OFF = '#13242b';

/**
 * The agent's suit, built on the mannequin's bones over a dark undersuit: a helmet with a lit visor, chest and back
 * plates with an energy core, a backpack with one lamp per engraving slot, pauldrons, bracers, a belt and greaves.
 * Must be called on a model in its rest pose (straight after cloning).
 */
export function buildSuitArmor(model: THREE.Object3D): SuitParts {
  const mats: THREE.MeshStandardMaterial[] = [];
  const lights: THREE.MeshStandardMaterial[] = [];
  const mat = (color: string, metal = 0.65, rough = 0.38) => { const m = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough }); mats.push(m); return m; };
  const shell = mat('#4a5866');
  const plate = mat('#8794a2', 0.7, 0.32);
  const dark = mat('#1a222b', 0.4, 0.6);
  // the glow keeps its own emissive (hit flashes would overwrite it), so it is not handed back
  const glow = new THREE.MeshStandardMaterial({ color: GLOW, emissive: GLOW, emissiveIntensity: 2.2 });
  model.updateMatrixWorld(true);
  const rootQ = model.getWorldQuaternion(new THREE.Quaternion());
  const s = model.getWorldScale(new THREE.Vector3()).y;
  const bone = (n: string) => model.getObjectByName(n);
  const at = (n: string) => bone(n)?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).multiplyScalar(s);

  /** A piece square to the body, centred at a world point, sized in metres of a full-size figure. */
  const piece = (boneName: string, geo: THREE.BufferGeometry, m: THREE.Material, center: THREE.Vector3) => {
    const b = bone(boneName);
    if (!b) return;
    const bs = b.getWorldScale(new THREE.Vector3());
    const mesh = new THREE.Mesh(geo.scale(s / bs.x, s / bs.y, s / bs.z), m);
    mesh.position.copy(center.clone().applyMatrix4(b.matrixWorld.clone().invert()));
    mesh.quaternion.copy(b.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootQ));
    mesh.castShadow = true;
    b.add(mesh);
  };
  /** A sleeve along a bone toward its child, covering `from`–`to` of its length. */
  const sleeve = (boneName: string, childName: string, thick: number, m: THREE.Material, from = 0, to = 1) => {
    const b = bone(boneName);
    const c = bone(childName);
    if (!b || !c) return;
    const dir = c.position.clone();
    const len = dir.length();
    const t = thick * s / b.getWorldScale(new THREE.Vector3()).x;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(t, len * (to - from), t).translate(0, len * (from + to) / 2, 0), m);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    b.add(mesh);
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

  const head = at('Head');
  const neck = at('neck_01');
  const chest = at('spine_03');
  const pelvis = at('pelvis');
  // helmet: a rounded shell, a dark face plate and a lit visor slit
  piece('Head', new THREE.SphereGeometry(0.15, 18, 12).scale(1, 1.05, 1.1), shell, head.clone().add(v(0, 0.1, 0)));
  piece('Head', box(0.2, 0.09, 0.05), dark, head.clone().add(v(0, 0.09, 0.135)));
  piece('Head', box(0.17, 0.028, 0.03), glow, head.clone().add(v(0, 0.105, 0.16)));
  // a lit crest along the crown so the agent reads from above
  piece('Head', box(0.03, 0.025, 0.24), glow, head.clone().add(v(0, 0.255, -0.01)));
  piece('neck_01', new THREE.CylinderGeometry(0.075, 0.09, 0.08, 10), dark, neck.clone().add(v(0, 0.01, 0)));
  // torso: chest plate with the core, back plate, backpack
  const chestMid = chest.clone().lerp(neck, 0.15);
  piece('spine_03', box(0.37, 0.26, 0.23), shell, chestMid);
  piece('spine_03', box(0.28, 0.12, 0.03), plate, chestMid.clone().add(v(0, 0.04, 0.125)));
  piece('spine_03', new THREE.CylinderGeometry(0.035, 0.035, 0.03, 14).rotateX(Math.PI / 2), glow, chestMid.clone().add(v(0, 0.035, 0.145)));
  piece('spine_02', box(0.32, 0.14, 0.2), dark, pelvis.clone().lerp(chest, 0.6));
  const pack = chestMid.clone().add(v(0, -0.02, -0.17));
  piece('spine_03', box(0.26, 0.3, 0.11), plate, pack);
  for (let i = 0; i < SUIT_SLOTS; i++) {
    const lamp = new THREE.MeshStandardMaterial({ color: LAMP_OFF, emissive: GLOW, emissiveIntensity: 0 });
    lights.push(lamp);
    piece('spine_03', box(0.045, 0.045, 0.02), lamp, pack.clone().add(v(i % 2 ? 0.05 : -0.05, 0.08 - Math.floor(i / 2) * 0.075, -0.06)));
  }
  piece('pelvis', box(0.36, 0.08, 0.23), plate, pelvis.clone().add(v(0, 0.03, 0)));
  for (const side of ['l', 'r'] as const) {
    const x = side === 'l' ? 1 : -1;
    piece(`upperarm_${side}`, box(0.15, 0.1, 0.17), plate, at(`upperarm_${side}`).add(v(0.02 * x, 0.05, 0)));
    piece(`upperarm_${side}`, box(0.025, 0.015, 0.16), glow, at(`upperarm_${side}`).add(v(0.06 * x, 0.105, 0)));
    sleeve(`lowerarm_${side}`, `hand_${side}`, 0.095, shell, 0.35, 1);
    sleeve(`thigh_${side}`, `calf_${side}`, 0.135, dark, 0.15, 0.85);
    sleeve(`calf_${side}`, `foot_${side}`, 0.12, shell, 0.1, 1);
    piece(`calf_${side}`, box(0.13, 0.09, 0.06), plate, at(`calf_${side}`).add(v(0, 0.02, 0.06)));
    sleeve(`foot_${side}`, `ball_${side}`, 0.12, dark, 0, 1.3);
  }
  return { mats, lights };
}

/** Light one lamp per filled engraving slot. */
export function lightSuit(lights: THREE.MeshStandardMaterial[], filled: number): void {
  lights.forEach((m, i) => { m.emissiveIntensity = i < filled ? 2.4 : 0; });
}
