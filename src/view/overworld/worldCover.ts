import * as THREE from 'three';
import type { Cell } from '../../sim/grid/types';
import type { Ground } from '../../sim/overworld/worldGen';
import type { WorldFog } from './worldFog';
import { instanced, jitter } from './worldProps';

type Item = { m: THREE.Matrix4; c: THREE.Color };
const mat4 = (x: number, y: number, z: number, s: THREE.Vector3, e: THREE.Euler): THREE.Matrix4 =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(e), s);

/**
 * Waist-high things to crouch behind: boulders, fallen logs, low stone walls, camp barricades (crossed stakes), burnt wrecks,
 * demon totems and obelisks, and ghost-fire braziers in the ruins. Glowing bits (flames, eyes) are drawn bright; the light itself comes from the pool.
 */
export function coverProps(ground: Ground[], w: number, fog: WorldFog): THREE.Group {
  const g = new THREE.Group();
  const at = (kind: Ground): Cell[] => { const out: Cell[] = []; ground.forEach((k, i) => { if (k === kind) out.push({ x: i % w, y: Math.floor(i / w) }); }); return out; };
  const kindAt = (c: Cell) => ground[c.y * w + c.x];
  const boulders: Item[] = [], logs: Item[] = [], walls: Item[] = [], stakes: Item[] = [], wrecks: Item[] = [], spires: Item[] = [], bowls: Item[] = [];
  for (const c of at('boulder')) {
    const s = 0.75 + jitter(c.x, c.y, 40) * 0.35;
    boulders.push({ m: mat4(c.x, 0.3 * s, c.y, new THREE.Vector3(s, s * 0.75, s), new THREE.Euler(0.3, jitter(c.x, c.y, 41) * 6, 0.2)), c: new THREE.Color().setHSL(0.08, 0.05, 0.3 + jitter(c.x, c.y, 42) * 0.1) });
  }
  for (const c of at('log')) {
    logs.push({ m: mat4(c.x, 0.22, c.y, new THREE.Vector3(1, 1, 1), new THREE.Euler(0, jitter(c.x, c.y, 43) * Math.PI, Math.PI / 2)), c: new THREE.Color('#5a4230') });
  }
  for (const c of at('lowWall')) {
    // a wall runs along its neighbours
    const vertical = kindAt({ x: c.x, y: c.y - 1 }) === 'lowWall' || kindAt({ x: c.x, y: c.y + 1 }) === 'lowWall';
    const h = 0.55 + jitter(c.x, c.y, 44) * 0.25;
    walls.push({ m: mat4(c.x, h / 2, c.y, new THREE.Vector3(1, h, 0.45), new THREE.Euler(0, vertical ? Math.PI / 2 : 0, (jitter(c.x, c.y, 45) - 0.5) * 0.1)), c: new THREE.Color().setHSL(0.09, 0.08, 0.32 + jitter(c.x, c.y, 46) * 0.08) });
  }
  for (const c of at('barricade')) for (const k of [-1, 1]) {
    stakes.push({ m: mat4(c.x, 0.45, c.y, new THREE.Vector3(1, 1, 1), new THREE.Euler(0, jitter(c.x, c.y, 47) * Math.PI, k * 0.6)), c: new THREE.Color('#4e3826') });
  }
  for (const c of at('wreck')) {
    wrecks.push({ m: mat4(c.x, 0.3, c.y, new THREE.Vector3(1.1, 0.6, 0.7), new THREE.Euler(0.1, jitter(c.x, c.y, 48) * 6, 0.25)), c: new THREE.Color('#2a2420') });
  }
  for (const c of [...at('totem'), ...at('obelisk')]) {
    const big = kindAt(c) === 'obelisk';
    spires.push({ m: mat4(c.x, big ? 1.4 : 0.9, c.y, new THREE.Vector3(big ? 0.9 : 0.5, big ? 2.8 : 1.8, big ? 0.9 : 0.5), new THREE.Euler(0, jitter(c.x, c.y, 49), 0)), c: new THREE.Color(big ? '#1e1418' : '#3a2418') });
  }
  for (const c of at('brazier')) bowls.push({ m: mat4(c.x, 0.3, c.y, new THREE.Vector3(1, 1, 1), new THREE.Euler()), c: new THREE.Color('#4a4640') });
  g.add(
    instanced(new THREE.DodecahedronGeometry(0.5, 0), fog, boulders),
    instanced(new THREE.CylinderGeometry(0.2, 0.24, 0.95, 7), fog, logs),
    instanced(new THREE.BoxGeometry(1, 1, 1), fog, walls),
    instanced(new THREE.BoxGeometry(0.1, 1.0, 0.1), fog, stakes),
    instanced(new THREE.BoxGeometry(1, 1, 1), fog, wrecks),
    instanced(new THREE.ConeGeometry(0.5, 1, 4), fog, spires),
    instanced(new THREE.CylinderGeometry(0.32, 0.2, 0.55, 8), fog, bowls),
  );
  // the glowing bits: embers on wrecks, red eyes on obelisks, ghost fire in braziers (a camp's totem eye belongs to the camp: it goes out with it)
  const glow = (color: string, cells: Cell[], y: number, geo: THREE.BufferGeometry) => {
    const mesh = new THREE.InstancedMesh(geo, fog.apply(new THREE.MeshBasicMaterial({ color })), Math.max(1, cells.length));
    cells.forEach((c, i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(c.x, y, c.y)));
    mesh.count = cells.length;
    g.add(mesh);
  };
  glow('#ff7a30', at('wreck'), 0.65, new THREE.IcosahedronGeometry(0.16, 0));
  glow('#ff2a48', at('obelisk'), 2.3, new THREE.OctahedronGeometry(0.2, 0));
  glow('#6affa8', at('brazier'), 0.7, new THREE.ConeGeometry(0.18, 0.45, 6));
  return g;
}
