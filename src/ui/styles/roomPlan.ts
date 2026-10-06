import * as THREE from 'three';

/** One dungeon room laid out once and built in each art style, so the styles compare on the same ground. */
export const W = 10;
export const D = 6;
/** floor cells run x 1..W, z 1..D; walls stand on the boundary lines round them */

export type PropKind = 'barrel' | 'barrels' | 'crates' | 'chest' | 'table' | 'chair' | 'rubble' | 'bones' | 'shelf' | 'keg';
export interface Prop { kind: PropKind; x: number; z: number; rot?: number }
export interface Fig { cls: 'warrior' | 'archer' | 'mage' | 'skeleton' | 'skelMage' | 'skelBrute'; x: number; z: number; foe?: boolean }

export const PILLARS: [number, number][] = [[3, 3], [8, 3], [3, 5], [8, 5]];
/** torches on the back wall (x) and the side walls (z) */
export const TORCH_BACK = [2, 6, 9];
export const TORCH_SIDE = [3];
/** the doorway in the back wall (cell x) */
export const DOOR_X = 4;
export const BANNER_X = 7;

export const PROPS: Prop[] = [
  { kind: 'barrels', x: 1, z: 1 }, { kind: 'barrel', x: 2, z: 1 }, { kind: 'crates', x: 10, z: 1 }, { kind: 'chest', x: 6, z: 1 },
  { kind: 'shelf', x: 10, z: 3, rot: -Math.PI / 2 }, { kind: 'table', x: 1, z: 5 }, { kind: 'chair', x: 2, z: 6, rot: Math.PI },
  { kind: 'rubble', x: 10, z: 6 }, { kind: 'bones', x: 6, z: 3 }, { kind: 'keg', x: 1, z: 3 },
];

export const FIGS: Fig[] = [
  { cls: 'warrior', x: 5, z: 5 }, { cls: 'archer', x: 4, z: 6 }, { cls: 'mage', x: 6, z: 6 },
  { cls: 'skelBrute', x: 6, z: 2, foe: true }, { cls: 'skeleton', x: 5, z: 3, foe: true }, { cls: 'skelMage', x: 7, z: 2, foe: true },
];

/** Every built style hands back its scene graph and whatever animates in it. */
export interface Built { root: THREE.Group; update(dt: number): void }

/** Faces a figure toward the other side (heroes look up the room, foes down). */
export const facing = (f: Fig): number => (f.foe ? 0 : Math.PI);
