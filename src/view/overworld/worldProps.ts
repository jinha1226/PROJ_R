import * as THREE from 'three';
import type { Cell } from '../../sim/grid/types';
import type { Camp } from '../../sim/overworld/worldGen';
import type { WorldFog } from './worldFog';

/** Deterministic jitter per cell (props keep their look between runs of the same world). */
export const jitter = (x: number, y: number, k = 0): number => {
  let h = (x * 73856093) ^ (y * 19349663) ^ (k * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Many copies of one shape, each with its own matrix and colour. */
export function instanced(geo: THREE.BufferGeometry, fog: WorldFog, items: { m: THREE.Matrix4; c: THREE.Color }[], shadow = true): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, fog.apply(new THREE.MeshLambertMaterial()), Math.max(1, items.length));
  items.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); });
  mesh.count = items.length;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

const mat4 = (x: number, y: number, z: number, s: THREE.Vector3, rotY = 0, tilt = 0): THREE.Matrix4 =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.6)), s);

/** Trees of a blighted land: bare dead trees (a crooked trunk, three branches) and dark pines; light falls through the dead ones. */
export function trees(cells: Cell[], fog: WorldFog): THREE.Group {
  const g = new THREE.Group();
  const trunks: { m: THREE.Matrix4; c: THREE.Color }[] = [], branches: typeof trunks = [], pine: typeof trunks = [];
  for (const c of cells) {
    const r = jitter(c.x, c.y), s = 0.8 + jitter(c.x, c.y, 1) * 0.5, ox = (jitter(c.x, c.y, 2) - 0.5) * 0.3, oz = (jitter(c.x, c.y, 3) - 0.5) * 0.3;
    if (r < 0.45) {
      trunks.push({ m: mat4(c.x + ox, 0.45 * s, c.y + oz, new THREE.Vector3(s, s, s)), c: new THREE.Color('#3a2c22') });
      pine.push({ m: mat4(c.x + ox, 1.5 * s, c.y + oz, new THREE.Vector3(s, s * (1 + r * 0.4), s), r * 6), c: new THREE.Color().setHSL(0.36, 0.25, 0.13 + jitter(c.x, c.y, 5) * 0.06) });
      continue;
    }
    // a dead tree: a tall leaning trunk with bare branches reaching out
    const lean = (jitter(c.x, c.y, 6) - 0.5) * 0.25, yaw = jitter(c.x, c.y, 7) * Math.PI * 2;
    trunks.push({ m: mat4(c.x + ox, 0.9 * s, c.y + oz, new THREE.Vector3(s * 0.8, s * 2, s * 0.8), yaw, lean), c: new THREE.Color().setHSL(0.07, 0.15, 0.14 + jitter(c.x, c.y, 8) * 0.06) });
    for (let k = 0; k < 3; k++) {
      const a = yaw + k * 2.1 + jitter(c.x, c.y, 9 + k), h = (1.0 + k * 0.35) * s;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(c.x + ox + Math.cos(a) * 0.22, h, c.y + oz + Math.sin(a) * 0.22),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9)), new THREE.Vector3(s * 0.5, s * 0.75, s * 0.5));
      branches.push({ m, c: new THREE.Color('#2e241c') });
    }
  }
  g.add(instanced(new THREE.CylinderGeometry(0.07, 0.13, 0.9, 5), fog, trunks));
  g.add(instanced(new THREE.CylinderGeometry(0.03, 0.06, 0.9, 4), fog, branches));
  g.add(instanced(new THREE.ConeGeometry(0.62, 1.9, 7), fog, pine));
  return g;
}

/** Rocky hills: lumpy grey stones, two per cell. */
export function rocks(cells: Cell[], fog: WorldFog): THREE.InstancedMesh {
  const items: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  for (const c of cells) for (let k = 0; k < 2; k++) {
    const s = 0.55 + jitter(c.x, c.y, 10 + k) * 0.5, tone = 0.32 + jitter(c.x, c.y, 12 + k) * 0.14;
    items.push({ m: mat4(c.x + (jitter(c.x, c.y, 14 + k) - 0.5) * 0.4, s * 0.45, c.y + (jitter(c.x, c.y, 16 + k) - 0.5) * 0.4, new THREE.Vector3(s, s * (0.8 + k * 0.5), s), jitter(c.x, c.y, 18 + k) * 6, 0.2), c: new THREE.Color().setHSL(0.08, 0.06, tone) });
  }
  return instanced(new THREE.DodecahedronGeometry(0.6, 0), fog, items);
}

/** Old walls: weathered blocks of uneven height. */
export function ruinWalls(cells: Cell[], fog: WorldFog): THREE.InstancedMesh {
  const items = cells.map((c) => {
    const hgt = 0.6 + jitter(c.x, c.y, 20) * 1.3;
    return { m: mat4(c.x, hgt / 2, c.y, new THREE.Vector3(0.95, hgt, 0.95), 0, (jitter(c.x, c.y, 21) - 0.5) * 0.08), c: new THREE.Color().setHSL(0.08, 0.1, 0.2 + jitter(c.x, c.y, 22) * 0.08) };
  });
  return instanced(new THREE.BoxGeometry(1, 1, 1), fog, items);
}

/** The crashed colony ship: a long hull nose-down in the clearing, a fin, cold lights along its side (its glow comes from the light pool). */
export function crashedShip(base: Cell, fog: WorldFog): THREE.Group {
  const root = new THREE.Group();
  const metal = fog.apply(new THREE.MeshLambertMaterial({ color: '#8a94a0' }));
  const dark = fog.apply(new THREE.MeshLambertMaterial({ color: '#3c4450' }));
  const glow = new THREE.MeshBasicMaterial({ color: '#5ae0ff' });
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 6.2, 6, 12), metal);
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 1, 0.85);
  hull.position.y = 0.9;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.15), dark);
  fin.position.set(2.8, 2.2, 0);
  fin.rotation.z = -0.3;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 4.6), dark);
  wing.position.set(0.6, 0.5, 0);
  wing.rotation.x = 0.12;
  root.add(hull, fin, wing);
  for (let i = 0; i < 5; i++) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.05), glow);
    lamp.position.set(-2.4 + i * 1.2, 1.0, 1.08);
    root.add(lamp);
  }
  for (const m of [hull, fin, wing]) { m.castShadow = true; m.receiveShadow = true; }
  // nose down, a little askew
  root.rotation.set(0, 0.12, -0.07);
  root.position.set(base.x - 0.5, 0, base.y);
  return root;
}

export interface CampView { camp: Camp; flame: THREE.Mesh; flag: THREE.Mesh; eye: THREE.Mesh }

/** A goblin camp: hide tents round a fire, a ring of stakes with gaps, a red banner, the totem's eye. */
export function campProps(camp: Camp, fog: WorldFog): { root: THREE.Group; view: CampView } {
  const root = new THREE.Group();
  const hide = fog.apply(new THREE.MeshLambertMaterial({ color: '#6a5032' }));
  const wood = fog.apply(new THREE.MeshLambertMaterial({ color: '#4a3424' }));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + jitter(camp.pos.x, camp.pos.y, k) * 0.8;
    const tent = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.3, 5), hide);
    tent.position.set(Math.cos(a) * 2.1, 0.65, Math.sin(a) * 2.1);
    tent.castShadow = true;
    root.add(tent);
  }
  for (let k = 0; k < 22; k++) {
    if (k % 7 === 3) continue;
    const a = (k / 22) * Math.PI * 2, stake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.0 + jitter(camp.pos.x, k, 3) * 0.4, 5), wood);
    stake.position.set(Math.cos(a) * 3.6, 0.5, Math.sin(a) * 3.6);
    stake.rotation.set((jitter(k, camp.pos.y, 4) - 0.5) * 0.3, 0, (jitter(k, camp.pos.y, 5) - 0.5) * 0.3);
    root.add(stake);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), fog.apply(new THREE.MeshBasicMaterial({ color: '#ffa040' })));
  flame.position.y = 0.3;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), wood);
  pole.position.set(0.9, 1.3, -0.6);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), fog.apply(new THREE.MeshLambertMaterial({ color: '#b02820', side: THREE.DoubleSide })));
  flag.position.set(1.3, 2.3, -0.6);
  // the demon totem's eye glows while the camp stands
  const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), fog.apply(new THREE.MeshBasicMaterial({ color: '#ff3030' })));
  eye.position.set(camp.totem.x - camp.pos.x, 1.55, camp.totem.y - camp.pos.y);
  root.add(flame, pole, flag, eye);
  root.position.set(camp.pos.x, 0, camp.pos.y);
  return { root, view: { camp, flame, flag, eye } };
}
