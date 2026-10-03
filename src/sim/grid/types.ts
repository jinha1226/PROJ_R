import type { Rng } from '../../core/rng';
import type { Gear } from './gear';
import type { BeltItem, Equipment } from './items';

/** 'open' is a door that has been opened. */
export type Tile = 'floor' | 'wall' | 'door' | 'open' | 'pillar';
export interface Cell { x: number; y: number }
export type FoeKind = 'minion' | 'brute' | 'ghoul' | 'archer' | 'mage' | 'champion';
export interface Room { x: number; y: number; w: number; h: number }
export interface GridMap {
  w: number;
  h: number;
  tiles: Tile[];
  rooms: Room[];
  start: Cell;
  exits: Cell[];
  chests: Cell[];
  spawns: { kind: FoeKind; pos: Cell; group: number }[];
  /** oil barrels (block the way, explode when hit) */
  barrels?: Cell[];
  /** the way down (floors 1–2) */
  stairs?: Cell;
}

export const idx = (m: { w: number }, c: Cell): number => c.y * m.w + c.x;
export const inBounds = (m: GridMap, c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < m.w && c.y < m.h;
export const tileAt = (m: GridMap, c: Cell): Tile => (inBounds(m, c) ? m.tiles[idx(m, c)]! : 'wall');
export const walkable = (t: Tile): boolean => t === 'floor' || t === 'open' || t === 'door';
export const opaque = (t: Tile): boolean => t === 'wall' || t === 'door' || t === 'pillar';
export const same = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;
export const add = (a: Cell, b: Cell): Cell => ({ x: a.x + b.x, y: a.y + b.y });
/** Chebyshev distance: diagonal steps cost the same as straight ones. */
export const dist = (a: Cell, b: Cell): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const DIRS: Cell[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

/** One step in direction d: the target must be walkable, and a diagonal may not cut a corner. */
export function canStep(m: GridMap, from: Cell, d: Cell): boolean {
  if (!walkable(tileAt(m, add(from, d)))) return false;
  if (d.x !== 0 && d.y !== 0) return walkable(tileAt(m, { x: from.x + d.x, y: from.y })) && walkable(tileAt(m, { x: from.x, y: from.y + d.y }));
  return true;
}

export type { Rng };

export interface Ent { id: string; kind: 'hero' | FoeKind; pos: Cell; hp: number; maxHp: number; nextAt: number; alive: boolean; awake: boolean; group: number; lastSeen?: Cell; stun?: number; status?: Statuses; power?: number; turns?: number; summoned?: boolean }
export interface Statuses { burn: number; freeze: number; poison: number }
/** fire or a poison cloud on the floor until a game time */
export interface TileFx { pos: Cell; kind: 'fire' | 'poison' | 'steam'; until: number }
export interface Hero extends Ent {
  kind: 'hero';
  level: number;
  xp: number;
  value: number;
  loot: { name: string; value: number }[];
  target?: string;
  /** time spent standing on an open exit */
  exitTime: number;
  gear: Gear;
}
export interface ChestState { pos: Cell; opened: boolean }
export interface GridState {
  seed: number;
  time: number;
  map: GridMap;
  hero: Hero;
  foes: Ent[];
  chests: ChestState[];
  /** 1 = seen at some point */
  seen: Uint8Array;
  visible: Set<number>;
  rng: Rng;
  events: GEvent[];
  outcome?: 'won' | 'dead';
  /** indices into map.exits that have closed */
  closedExits: number[];
  /** danger steps already fired (0 none, 1 alarm, 2 reinforcements) */
  danger: number;
  nextFoeId: number;
  floorItems: FloorItem[];
  run: RunState;
  tiles: TileFx[];
  barrels: Cell[];
  telegraphs: Telegraph[];
}
/** A marked area that goes off on its caster's turn at or after `at` (a mage's spell, the champion's whirl). */
export interface Telegraph { cells: Cell[]; center: Cell; src: string; kind: 'spell' | 'whirl'; el?: 'fire' | 'frost'; dmg: [number, number]; at: number }
export interface RunState { floor: number; kills: number; won: boolean; floorStart: number; waves: number }
export interface FloorItem { pos: Cell; item: Equipment }
export type GAction =
  | { kind: 'move'; dir: Cell } | { kind: 'shoot'; target?: string; at?: Cell } | { kind: 'wait' }
  | { kind: 'swap' } | { kind: 'equip'; bag: number } | { kind: 'wear'; bag: number } | { kind: 'drop'; bag: number }
  | { kind: 'use'; item: BeltItem; at?: Cell };
export type GEventType =
  | 'move' | 'bump' | 'shoot' | 'hit' | 'miss' | 'die' | 'door' | 'open' | 'loot' | 'reload' | 'heal' | 'wait' | 'wake' | 'blocked'
  | 'alarm' | 'reinforce' | 'exitClosed' | 'extracting' | 'extracted' | 'dead'
  | 'swap' | 'equip' | 'wear' | 'drop' | 'pickup' | 'full' | 'stun' | 'push' | 'use' | 'explode' | 'frozen' | 'status'
  | 'telegraph' | 'summon' | 'floor' | 'victory' | 'levelUp' | 'react' | 'dodge' | 'parry';
/** t: the game time the acting entity started this action (the view plays events in this order). */
export interface GEvent { t: number; type: GEventType; src?: string; dst?: string; from?: Cell; to?: Cell; amount?: number; crit?: boolean; text?: string }

export const COST = { move: 1, wait: 1, potion: 1, open: 0.5, swap: 0.5, equip: 1, drop: 0.5, bash: 1 };
export const HERO = { hp: 30, sight: 8, heal: 12, bash: [2, 4] as const, bashHit: 0.9 };
export const FOES: Record<FoeKind, { hp: number; move: number; dmg: readonly [number, number]; range: number; hit: number }> = {
  minion: { hp: 10, move: 1, dmg: [3, 5], range: 1, hit: 0.8 },
  archer: { hp: 8, move: 1, dmg: [3, 5], range: 7, hit: 0.85 },
  brute: { hp: 20, move: 1.4, dmg: [6, 9], range: 1, hit: 0.8 },
  ghoul: { hp: 12, move: 0.7, dmg: [3, 6], range: 1, hit: 0.8 },
  mage: { hp: 10, move: 1, dmg: [4, 7], range: 6, hit: 1 },
  champion: { hp: 70, move: 1, dmg: [8, 12], range: 1, hit: 0.85 },
};
