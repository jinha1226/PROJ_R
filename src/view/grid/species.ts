import * as THREE from 'three';
import { zoneOf } from '../../sim/grid/zones';
import type { Ent } from '../../sim/grid/types';
import type { UalLook } from './ualActor';

export type Species = 'goblin' | 'skeleton' | 'orc';
type FoeKind = Exclude<Ent['kind'], 'hero'>;

/** Each zone has its own folk: goblins in the caves, the dead in the crypt, orcs in the ruins. */
export function speciesOf(floor: number): Species {
  const z = zoneOf(floor).id;
  return z === 'cave' ? 'goblin' : z === 'crypt' ? 'skeleton' : 'orc';
}

/** Per-bone proportions laid over the animation every frame: a scale per bone and a forward hunch of the spine. */
export interface BodyShape { scale: Record<string, number | [number, number, number]>; hunch: number; thin?: string[]; thinBy?: number }

const SHAPES: Record<Species, BodyShape> = {
  // small, big-headed, long-armed and stooped
  goblin: { scale: { Head: 1.4, upperarm_l: 1.12, upperarm_r: 1.12, hand_l: 0.9, hand_r: 0.9 }, hunch: 0.32 },
  // gaunt: limbs and waist pared to the bone
  skeleton: { scale: { Head: 1.05 }, hunch: 0.06, thin: ['upperarm_l', 'upperarm_r', 'thigh_l', 'thigh_r', 'spine_01'], thinBy: 0.55 },
  // broad-shouldered and heavy, a small head sunk forward
  // (hands scaled back so the weapon they hold keeps its size)
  orc: { scale: { Head: 0.85, clavicle_l: 1.22, clavicle_r: 1.22, upperarm_l: 1.12, upperarm_r: 1.12, spine_03: 1.12, hand_l: 0.75, hand_r: 0.75 }, hunch: 0.16 },
};

const SIZE: Record<Species, number> = { goblin: 0.78, skeleton: 0.95, orc: 1.12 };

/** body / trim colours per kind, per species */
const COLORS: Record<Species, Record<FoeKind, [string, string]>> = {
  goblin: { minion: ['#7aa040', '#4a3a22'], archer: ['#8aac52', '#3a4a2a'], brute: ['#5a7a30', '#3a2a1a'], ghoul: ['#6a8a4a', '#3a2a1a'], mage: ['#6a8a3a', '#6a2a6a'], champion: ['#4f7a2a', '#d8b040'] },
  skeleton: { minion: ['#d8d2c0', '#7a7262'], archer: ['#cfc8b0', '#4a5a3a'], brute: ['#bdb59c', '#6a3a2a'], ghoul: ['#6a8a4a', '#3a2a1a'], mage: ['#c8c0d8', '#4a2a6a'], champion: ['#e0dccc', '#d8b040'] },
  orc: { minion: ['#6a7a58', '#3a3028'], archer: ['#738260', '#3a4a2a'], brute: ['#56664a', '#2a2420'], ghoul: ['#5a7a4a', '#2a2a1a'], mage: ['#606f58', '#2a6a6a'], champion: ['#4c5a42', '#b03a2a'] },
};

/** A foe's look in this species: base kit (weapon, stance, size) from the kind, colours and build from the species. */
export function foeLook(base: UalLook, kind: FoeKind, species: Species): UalLook {
  const [body, trim] = COLORS[species][kind];
  // ghouls are ghouls everywhere: their own shamble, no species build
  if (kind === 'ghoul') return { ...base, body, trim };
  return { ...base, body, trim, scale: base.scale * SIZE[species], shape: SHAPES[species], species };
}

/** Bones and their target scales (thin bones scaled across their length only), and the spine bone to hunch. */
export function shapeBones(model: THREE.Object3D, shape: BodyShape): { bones: [THREE.Object3D, THREE.Vector3][]; spine: THREE.Object3D | undefined } {
  const bones = new Map<string, THREE.Vector3>();
  for (const [name, s] of Object.entries(shape.scale)) bones.set(name, Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s));
  for (const name of shape.thin ?? []) {
    const b = model.getObjectByName(name);
    const child = b?.children.find((c) => (c as THREE.Bone).isBone);
    if (!child) continue;
    // keep the length axis, pare the two across it
    const p = child.position;
    const ax = Math.abs(p.x) >= Math.abs(p.y) && Math.abs(p.x) >= Math.abs(p.z) ? 'x' : Math.abs(p.y) >= Math.abs(p.z) ? 'y' : 'z';
    const k = shape.thinBy ?? 0.6;
    bones.set(name, new THREE.Vector3(ax === 'x' ? 1 : k, ax === 'y' ? 1 : k, ax === 'z' ? 1 : k));
  }
  const list: [THREE.Object3D, THREE.Vector3][] = [];
  for (const [name, s] of bones) { const b = model.getObjectByName(name); if (b) list.push([b, s]); }
  return { bones: list, spine: model.getObjectByName('spine_02') };
}
