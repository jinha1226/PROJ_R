import type { Rng } from '../../core/rng';

/** 'open' is a door that has been opened. */
export type Tile = 'floor' | 'wall' | 'door' | 'open' | 'pillar';
export interface Cell { x: number; y: number }
export type FoeKind = 'minion' | 'archer' | 'brute';
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
