import { createRng, type Rng } from '../../core/rng';
import { distanceMap } from '../grid/path';
import { idx, type Cell, type FoeKind, type GridMap, type Tile } from '../grid/types';
import { BASE_CLASSES, type BaseClass } from '../party/partyDefs';

/** what a cell looks like (the sim only cares about its tile) */
export type Ground = 'grass' | 'forest' | 'tree' | 'rock' | 'water' | 'ford' | 'dirt' | 'ruin' | 'ruinWall' | 'ship' | 'camp';
export interface Camp { id: number; pos: Cell; tier: 1 | 2 | 3; group: number; cleared: boolean }
/** a fallen native's soul stone lying on the land */
export interface Soul { id: number; pos: Cell; cls: BaseClass; taken: boolean }
export interface World { map: GridMap; ground: Ground[]; camps: Camp[]; base: Cell; souls: Soul[] }

export const WORLD_SIZE = 96;
const TILE: Record<Ground, Tile> = { grass: 'floor', forest: 'floor', tree: 'pillar', rock: 'wall', water: 'chasm', ford: 'floor', dirt: 'floor', ruin: 'floor', ruinWall: 'wall', ship: 'wall', camp: 'floor' };
/** camps by ring: how many, how far from the base, how strong */
const RINGS: { n: number; near: number; far: number; tier: 1 | 2 | 3 }[] = [{ n: 3, near: 17, far: 24, tier: 1 }, { n: 3, near: 28, far: 35, tier: 2 }, { n: 2, near: 38, far: 44, tier: 3 }];
const PACKS: Record<1 | 2 | 3, FoeKind[]> = {
  1: ['minion', 'minion', 'minion', 'archer'],
  2: ['minion', 'minion', 'minion', 'archer', 'archer', 'brute'],
  3: ['minion', 'minion', 'minion', 'archer', 'archer', 'brute', 'brute'],
};

/** Smooth value noise in [0, 1] (a few octaves of a hashed lattice). */
function noise(seed: number): (x: number, y: number) => number {
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * (t * t * (3 - 2 * t));
  const at = (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    return lerp(lerp(hash(x0, y0), hash(x0 + 1, y0), tx), lerp(hash(x0, y0 + 1), hash(x0 + 1, y0 + 1), tx), ty);
  };
  return (x, y) => (at(x / 14, y / 14) * 0.6 + at(x / 6, y / 6) * 0.3 + at(x / 3, y / 3) * 0.1);
}

const near = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.y - b.y);

/** The land round the crashed ship: woods, rocky hills, a river with fords, ruins, and goblin camps that grow stronger farther out. */
export function generateWorld(seed: number): World {
  const N = WORLD_SIZE, rng = createRng((seed ^ 0x77a1d) >>> 0);
  const base = { x: N >> 1, y: N >> 1 };
  const ground: Ground[] = new Array<Ground>(N * N).fill('grass');
  const elev = noise(seed * 3 + 1), wet = noise(seed * 7 + 2);
  const set = (c: Cell, g: Ground) => { if (c.x >= 0 && c.y >= 0 && c.x < N && c.y < N) ground[c.y * N + c.x] = g; };
  const get = (c: Cell): Ground => ground[c.y * N + c.x]!;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = { x, y }, d = near(c, base);
    if (x === 0 || y === 0 || x === N - 1 || y === N - 1) { set(c, 'rock'); continue; }
    if (d <= 9) continue;
    const e = elev(x, y), m = wet(x, y);
    if (e > 0.66) set(c, 'rock');
    else if (m > 0.6) set(c, rng.chance(Math.min(0.6, 0.3 + (m - 0.6) * 1.6)) ? 'tree' : 'forest');
    else if (rng.chance(0.025)) set(c, 'tree');
  }
  river(rng, base, set);
  const ruins: Cell[] = [];
  for (let n = 0; n < 4; n++) ruins.push(ruin(rng, base, set));
  const camps = placeCamps(rng, base, set, get);
  for (const c of camps) if (c.tier === 1) road(rng, base, c.pos, set, get);
  ship(base, set);
  const map: GridMap = { w: N, h: N, tiles: ground.map((g) => TILE[g]), rooms: [], start: { x: base.x, y: base.y + 3 }, exits: [], chests: [], spawns: [], barrels: [] };
  connect(map, ground, camps.map((c) => c.pos));
  for (const camp of camps) {
    const cells = ring(camp.pos, 2).filter((c) => map.tiles[idx(map, c)] === 'floor');
    PACKS[camp.tier].forEach((kind, i) => map.spawns.push({ kind, pos: cells[i % cells.length]!, group: camp.group, elite: camp.tier === 3 && i === 5 }));
  }
  return { map, ground, camps, base, souls: placeSouls(rng, map, base, ruins, camps) };
}

/** Soul stones: one in the open near the ship (the first), one inside each ruin, one at the heart of each camp; the classes go round so the nearest ones differ. */
function placeSouls(rng: Rng, map: GridMap, base: Cell, ruins: Cell[], camps: Camp[]): Soul[] {
  const d = distanceMap(map, map.start);
  const open = (c: Cell) => map.tiles[idx(map, c)] === 'floor' && d[idx(map, c)]! > 0;
  const spot = (c: Cell): Cell | undefined => [c, ...ring(c, 3)].find(open);
  const first: Cell[] = [];
  for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) { const r = near({ x, y }, base); if (r >= 11 && r <= 14 && open({ x, y })) first.push({ x, y }); }
  const where = [first.length ? rng.pick(first) : undefined, ...ruins.map(spot), ...camps.map((c) => spot(c.pos))].filter((c): c is Cell => !!c);
  where.sort((a, b) => near(a, base) - near(b, base));
  const order = rng.shuffle([...BASE_CLASSES]);
  return where.map((pos, id) => ({ id, pos, cls: order[id % order.length]!, taken: false }));
}

/** Cells within a square radius, nearest first. */
function ring(c: Cell, r: number): Cell[] {
  const out: Cell[] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx || dy) out.push({ x: c.x + dx, y: c.y + dy });
  return out.sort((a, b) => near(a, c) - near(b, c));
}

/** A river across the map, clear of the base, crossed by three fords. */
function river(rng: Rng, base: Cell, set: (c: Cell, g: Ground) => void): void {
  const N = WORLD_SIZE, side = rng.chance(0.5) ? 1 : -1, off = side * rng.int(20, 26), amp = rng.int(3, 6), ph = rng.next() * 6;
  const fords = [rng.int(12, 26), rng.int(40, 56), rng.int(70, 84)];
  const vertical = rng.chance(0.5);
  for (let i = 1; i < N - 1; i++) {
    const j = Math.round((vertical ? base.x : base.y) + off + amp * Math.sin(i / 9 + ph));
    const ford = fords.some((f) => Math.abs(f - i) <= 1);
    for (const w of [0, 1]) set(vertical ? { x: j + w, y: i } : { x: i, y: j + w }, ford ? 'ford' : 'water');
  }
}

/** A broken square of old walls with a way in; returns its middle. */
function ruin(rng: Rng, base: Cell, set: (c: Cell, g: Ground) => void): Cell {
  const a = rng.next() * Math.PI * 2, d = rng.int(14, 40), w = rng.int(5, 8), h = rng.int(5, 7);
  const x0 = Math.round(base.x + Math.cos(a) * d), y0 = Math.round(base.y + Math.sin(a) * d);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
    set({ x, y }, edge && rng.chance(0.65) ? 'ruinWall' : 'ruin');
  }
  return { x: x0 + (w >> 1), y: y0 + (h >> 1) };
}

/** Camps on three rings, spread round the base, each in a cleared patch. */
function placeCamps(rng: Rng, base: Cell, set: (c: Cell, g: Ground) => void, get: (c: Cell) => Ground): Camp[] {
  const camps: Camp[] = [];
  let id = 0;
  for (const r of RINGS) {
    const start = rng.next() * Math.PI * 2;
    for (let k = 0; k < r.n; k++) {
      let pos: Cell | undefined;
      for (let t = 0; t < 30 && !pos; t++) {
        const a = start + (k / r.n) * Math.PI * 2 + (rng.next() - 0.5) * 0.6, d = rng.int(r.near, r.far);
        const c = { x: Math.round(base.x + Math.cos(a) * d), y: Math.round(base.y + Math.sin(a) * d) };
        const inside = c.x > 4 && c.y > 4 && c.x < WORLD_SIZE - 5 && c.y < WORLD_SIZE - 5;
        if (inside && get(c) !== 'water' && get(c) !== 'ford' && camps.every((o) => near(o.pos, c) > 12)) pos = c;
      }
      if (!pos) continue;
      for (const c of [pos, ...ring(pos, 3)]) if (near(c, pos) <= 3.2 && get(c) !== 'water' && get(c) !== 'ford') set(c, 'camp');
      camps.push({ id, pos, tier: r.tier, group: 100 + id, cleared: false });
      id++;
    }
  }
  return camps;
}

/** A dirt track from the clearing to a near camp, wandering a little; it cuts through trees and rocks and fords water. */
function road(rng: Rng, from: Cell, to: Cell, set: (c: Cell, g: Ground) => void, get: (c: Cell) => Ground): void {
  let c = { ...from };
  for (let i = 0; i < 200 && near(c, to) > 3; i++) {
    const g = get(c);
    if (g !== 'ship' && g !== 'camp') set(c, g === 'water' || g === 'ford' ? 'ford' : 'dirt');
    const dx = Math.sign(to.x - c.x), dy = Math.sign(to.y - c.y);
    const r = rng.next();
    c = r < 0.15 ? { x: c.x + dx, y: c.y } : r < 0.3 ? { x: c.x, y: c.y + dy } : { x: c.x + dx, y: c.y + dy };
  }
}

/** The crashed ship lies across the middle of the clearing. */
function ship(base: Cell, set: (c: Cell, g: Ground) => void): void {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -4; dx <= 3; dx++) if (!(Math.abs(dy) === 1 && (dx === -4 || dx === 3))) set({ x: base.x + dx, y: base.y + dy }, 'ship');
}

/** Every camp can be walked to from the base: a cut is made through trees, rocks and water where it cannot. */
function connect(map: GridMap, ground: Ground[], goals: Cell[]): void {
  for (const g of goals) {
    const d = distanceMap(map, map.start);
    if (d[idx(map, g)]! >= 0) continue;
    // walk from the goal toward the base until a reachable cell, clearing the way
    let c = { ...g };
    for (let i = 0; i < 200 && d[idx(map, c)]! < 0; i++) {
      const k = idx(map, c);
      if (map.tiles[k] !== 'floor') { map.tiles[k] = 'floor'; ground[k] = ground[k] === 'water' ? 'ford' : 'dirt'; }
      const dx = Math.sign(map.start.x - c.x), dy = Math.sign(map.start.y - c.y);
      c = Math.abs(map.start.x - c.x) > Math.abs(map.start.y - c.y) ? { x: c.x + dx, y: c.y } : { x: c.x, y: c.y + dy };
    }
  }
}
