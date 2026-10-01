import type { Vec2 } from '../../core/vec2';
import type { Bounds, Obstacle } from '../battle/types';

export type PoiKind = 'ruins' | 'camp' | 'nest' | 'temple' | 'vault' | 'swamp' | 'boss';
export type ContainerKind = 'crate' | 'supply' | 'relic' | 'bag' | 'herb' | 'vault';

export interface Container { id: string; kind: ContainerKind; pos: Vec2; tier: number; poi?: string; extra?: string[] }
export interface Spawn { id: string; enemyId: string; pos: Vec2; stage: number; group: string; patrol?: Vec2[] }
export interface Poi { id: string; kind: PoiKind; center: Vec2; radius: number; risk: 1 | 2 | 3; door?: { box: Obstacle; key: string } }
export interface Prop { ref: string; pos: Vec2; rot: number; scale: number }
/** Visual-only terrain features (some also appear in `obstacles` as boxes). */
export interface Decor { kind: 'water' | 'cliff' | 'road'; pos: Vec2; half: Vec2 }
export interface ExtractPoint { id: string; pos: Vec2; radius: number; /** seconds into the sortie */ closesAt?: number }

export interface Region {
  seed: number;
  layout: 'cross' | 'river' | 'canyon';
  bounds: Bounds;
  obstacles: Obstacle[];
  props: Prop[];
  decor: Decor[];
  pois: Poi[];
  containers: Container[];
  spawns: Spawn[];
  extracts: ExtractPoint[];
  hazards: { kind: 'poison'; center: Vec2; radius: number }[];
  start: Vec2;
}

/** Pieces a point of interest contributes to the region. */
export interface PoiBuild {
  poi: Poi;
  obstacles: Obstacle[];
  props: Prop[];
  containers: Container[];
  spawns: Spawn[];
  hazards: Region['hazards'];
}
