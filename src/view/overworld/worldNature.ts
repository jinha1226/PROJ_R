import * as THREE from 'three';
import type { Cell } from '../../sim/grid/types';
import type { NatureKit, NaturePart } from './natureKit';
import type { WorldFog } from './worldFog';
import { jitter } from './worldProps';

/** Places the pack's models on cells as instanced meshes, one per variant; `pick` chooses a variant (or none) and its scale for a cell. */
function place(cells: Cell[], fog: WorldFog, pick: (c: Cell) => { part: NaturePart; scale: number } | null, shadow: boolean): THREE.Group {
  const g = new THREE.Group();
  const byPart = new Map<NaturePart, THREE.Matrix4[]>();
  for (const c of cells) {
    const it = pick(c);
    if (!it) continue;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(c.x + (jitter(c.x, c.y, 71) - 0.5) * 0.35, 0, c.y + (jitter(c.x, c.y, 72) - 0.5) * 0.35),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, jitter(c.x, c.y, 73) * Math.PI * 2, 0)),
      new THREE.Vector3(it.scale, it.scale, it.scale));
    byPart.set(it.part, [...(byPart.get(it.part) ?? []), m]);
  }
  for (const [part, list] of byPart) {
    const mats = part.mats.map((m) => fog.apply(m.clone()));
    const mesh = new THREE.InstancedMesh(part.geo, mats.length === 1 ? mats[0]! : mats, list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

const choose = (list: NaturePart[], x: number, y: number, k: number): NaturePart | undefined => list[Math.floor(jitter(x, y, k) * list.length)];

/** Blighted woods: dead and twisted trees, some dark pines. */
export function natureTrees(cells: Cell[], kit: NatureKit, fog: WorldFog): THREE.Group {
  const dead = kit.variants('DeadTree'), twisted = kit.variants('TwistedTree'), pine = kit.variants('Pine');
  return place(cells, fog, (c) => {
    const r = jitter(c.x, c.y, 70);
    const list = r < 0.4 ? dead : r < 0.75 ? twisted : pine;
    const part = choose(list, c.x, c.y, 74) ?? choose(dead, c.x, c.y, 74);
    return part ? { part, scale: 0.85 + jitter(c.x, c.y, 75) * 0.35 } : null;
  }, true);
}

/** Rocky hills and boulders. */
export function natureRocks(cells: Cell[], kit: NatureKit, fog: WorldFog, scale: number): THREE.Group {
  const rocks = kit.variants('RockMedium');
  return place(cells, fog, (c) => { const part = choose(rocks, c.x, c.y, 76); return part ? { part, scale: scale * (0.85 + jitter(c.x, c.y, 77) * 0.4) } : null; }, true);
}

/** Grass, ferns and the odd mushroom on open ground (sparse). */
export function natureTufts(cells: Cell[], kit: NatureKit, fog: WorldFog): THREE.Group {
  const kinds = [kit.variants('GrassWispy'), kit.variants('TallGrass'), kit.variants('Fern'), kit.variants('Mushroom'), kit.variants('MushroomLaetiporus'), kit.variants('PebbleRound')];
  return place(cells, fog, (c) => {
    const r = jitter(c.x, c.y, 78);
    if (r > 0.3) return null;
    const list = r < 0.12 ? kinds[0]! : r < 0.18 ? kinds[1]! : r < 0.23 ? kinds[2]! : r < 0.25 ? kinds[3]! : r < 0.26 ? kinds[4]! : kinds[5]!;
    const part = choose(list, c.x, c.y, 79);
    return part ? { part, scale: 0.8 + jitter(c.x, c.y, 80) * 0.5 } : null;
  }, false);
}
