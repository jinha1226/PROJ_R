import { createRng, type Rng } from '../../core/rng';
import { distanceMap } from '../grid/path';
import { idx, type Cell, type FoeKind, type GridMap, type Tile } from '../grid/types';
import { BASE_CLASSES, type BaseClass } from '../party/partyDefs';
import { rollMemory } from '../party/memories';

/** what a cell looks like (the sim only cares about its tile) */
export type Ground = 'grass' | 'forest' | 'tree' | 'rock' | 'water' | 'ford' | 'dirt' | 'ruin' | 'ruinWall' | 'ship' | 'camp'
  /** waist-high things: they stop a step but not a look, and a body tucked behind one is hard to shoot */
  | 'boulder' | 'log' | 'lowWall' | 'barricade' | 'wreck' | 'totem' | 'obelisk' | 'brazier'
  /** the drill rig over the shaft down */
  | 'drill'
  /** the clone printer beside the pod */
  | 'cloner';
/** what can be crouched behind */
export const COVER: ReadonlySet<Ground> = new Set(['boulder', 'log', 'lowWall', 'barricade', 'wreck', 'totem', 'obelisk', 'brazier']);
/** lights that stand on the land itself (camp fires, souls and the ship light themselves) */
export interface LandLight { pos: Cell; kind: 'wreck' | 'brazier' | 'obelisk' }
export interface Camp { id: number; pos: Cell; tier: 1 | 2 | 3; group: number; cleared: boolean; totem: Cell }
import type { Soul } from '../roam/roam';
export type { Soul };
/** a small band away from any camp (no land to take, just a fight) */
export interface Stray { group: number; pos: Cell }
export interface World { map: GridMap; ground: Ground[]; camps: Camp[]; base: Cell; souls: Soul[]; lights: LandLight[]; strays: Stray[];
  /** the shaft down: the pod itself (the pod's landing ground only) */
  drill?: Cell;
  /** the clone printer (the pod's landing ground only) */
  cloner?: Cell;
  /** a landing pod stands at the base instead of the crashed ship */
  pod?: boolean }

export const WORLD_SIZE = 96;
export const TILE: Record<Ground, Tile> = { grass: 'floor', forest: 'floor', tree: 'pillar', rock: 'wall', water: 'chasm', ford: 'floor', dirt: 'floor', ruin: 'floor', ruinWall: 'wall', ship: 'wall', camp: 'floor',
  boulder: 'chasm', log: 'chasm', lowWall: 'chasm', barricade: 'chasm', wreck: 'chasm', totem: 'chasm', obelisk: 'chasm', brazier: 'chasm', drill: 'chasm', cloner: 'chasm' };
/** camps by ring: how many, how far from the base, how strong */
const RINGS: { n: number; near: number; far: number; tier: 1 | 2 | 3 }[] = [{ n: 3, near: 22, far: 28, tier: 1 }, { n: 3, near: 30, far: 37, tier: 2 }, { n: 2, near: 39, far: 45, tier: 3 }];
/** lone goblins and pairs wandering near the ship: the first fights, for an empty body or a single soul */
const STRAYS = 4;
const PACKS: Record<1 | 2 | 3, FoeKind[]> = {
  1: ['minion', 'minion', 'archer'],
  2: ['minion', 'minion', 'minion', 'archer', 'archer'],
  3: ['minion', 'minion', 'minion', 'archer', 'archer', 'brute', 'brute'],
};

/** Smooth value noise in [0, 1] (a few octaves of a hashed lattice). */
export function noise(seed: number): (x: number, y: number) => number {
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

export const near = (a: Cell, b: Cell): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The land round the crashed ship: woods, rocky hills, a river with fords, ruins, and goblin camps that grow stronger farther out. */
export function generateWorld(seed: number, opts: { pod?: boolean } = {}): World {
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
    else if (m > 0.6) set(c, rng.chance(Math.min(0.5, 0.24 + (m - 0.6) * 1.4)) ? 'tree' : 'forest');
    else if (rng.chance(0.025)) set(c, 'tree');
  }
  river(rng, base, set);
  const ruins: Cell[] = [];
  // one ruin close by (the second soul is in reach before any camp), the rest farther out
  for (let n = 0; n < 4; n++) ruins.push(ruin(rng, base, set, n === 0 ? 14 : 18, n === 0 ? 19 : 40));
  // the pod's land is ours from the start: no camps and no strays (raids come from the map's edge instead)
  const camps = opts.pod ? [] : placeCamps(rng, base, set, get);
  for (const c of camps) if (c.tier === 1) road(rng, base, c.pos, set, get);
  const lights = cover(rng, base, ruins, camps, set, get);
  // a landing pod (2×2), or the crashed ship lying across the clearing
  if (opts.pod) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set({ x: base.x + dx!, y: base.y + dy! }, 'ship');
  else ship(base, set);
  // the pod drills down where it landed (it is the shaft); its lab unfolds beside it, the clone printer first
  const drill = opts.pod ? { ...base } : undefined;
  const cloner = opts.pod ? { x: base.x - 3, y: base.y } : undefined;
  const map: GridMap = { w: N, h: N, tiles: ground.map((g) => TILE[g]), rooms: [], start: { x: base.x, y: base.y + 3 }, exits: [], chests: [], spawns: [], barrels: [] };
  // the pod is a small capsule: in the way, but nothing to hide behind (the crashed ship stays a wall)
  if (opts.pod) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) map.tiles[idx(map, { x: base.x + dx!, y: base.y + dy! })] = 'chasm';
  connect(map, ground, camps.map((c) => c.pos));
  for (const camp of camps) {
    const cells = ring(camp.pos, 2).filter((c) => map.tiles[idx(map, c)] === 'floor');
    PACKS[camp.tier].forEach((kind, i) => map.spawns.push({ kind, pos: cells[i % cells.length]!, group: camp.group, elite: camp.tier === 3 && i === 5 }));
  }
  const souls = placeSouls(rng, map, base, ruins, camps);
  // a soul walled in by rubble still has a way to it
  connect(map, ground, souls.map((x) => x.pos));
  const strays = opts.pod ? [] : placeStrays(rng, map, base, souls);
  return { map, ground, camps, base, souls, lights, strays, drill, cloner, pod: opts.pod };
}

/** Lone goblins and pairs in the open near the ship, kept clear of the first souls. */
function placeStrays(rng: Rng, map: GridMap, base: Cell, souls: Soul[]): Stray[] {
  const d = distanceMap(map, map.start), out: Stray[] = [];
  const ok = (c: Cell) => map.tiles[idx(map, c)] === 'floor' && d[idx(map, c)]! > 0 && souls.every((s) => near(s.pos, c) > 6) && out.every((o) => near(o.pos, c) > 8);
  for (let n = 0; n < STRAYS; n++) {
    let pos: Cell | undefined;
    for (let t = 0; t < 80 && !pos; t++) {
      const a = rng.next() * Math.PI * 2, r = rng.int(12, 18);
      const c = { x: Math.round(base.x + Math.cos(a) * r), y: Math.round(base.y + Math.sin(a) * r) };
      if (ok(c)) pos = c;
    }
    if (!pos) continue;
    const group = 200 + n;
    out.push({ group, pos });
    map.spawns.push({ kind: 'minion', pos, group });
    const mate = ring(pos, 1).find((c) => map.tiles[idx(map, c)] === 'floor');
    if (n % 2 === 1 && mate) map.spawns.push({ kind: 'minion', pos: mate, group });
  }
  return out;
}

/** Soul stones: one in the open near the ship (the first, an archer), one inside each ruin, one at the heart of each camp; the classes go round so the nearest ones differ. */
function placeSouls(rng: Rng, map: GridMap, base: Cell, ruins: Cell[], camps: Camp[]): Soul[] {
  const d = distanceMap(map, map.start);
  const open = (c: Cell) => map.tiles[idx(map, c)] === 'floor' && d[idx(map, c)]! > 0;
  const spot = (c: Cell): Cell | undefined => [c, ...ring(c, 3)].find((x) => map.tiles[idx(map, x)] === 'floor');
  const first: Cell[] = [];
  for (let y = 1; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) { const r = near({ x, y }, base); if (r >= 11 && r <= 14 && open({ x, y })) first.push({ x, y }); }
  const where = [first.length ? rng.pick(first) : undefined, ...ruins.map(spot), ...camps.map((c) => spot(c.pos))].filter((c): c is Cell => !!c);
  where.sort((a, b) => near(a, base) - near(b, base));
  // the first soul is an archer (an empty body can shoot from safety); the rest go round
  const order: BaseClass[] = ['archer', ...rng.shuffle(BASE_CLASSES.filter((c) => c !== 'archer'))];
  return where.map((pos, id) => ({ id, pos, cls: order[id % order.length]!, taken: false, memory: rollMemory(rng) }));
}

/** Cells within a square radius, nearest first. */
export function ring(c: Cell, r: number): Cell[] {
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
function ruin(rng: Rng, base: Cell, set: (c: Cell, g: Ground) => void, from: number, to: number): Cell {
  const a = rng.next() * Math.PI * 2, d = rng.int(from, to), w = rng.int(5, 8), h = rng.int(5, 7);
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
      camps.push({ id, pos, tier: r.tier, group: 100 + id, cleared: false, totem: { x: pos.x + 1, y: pos.y - 1 } });
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

/** Cover and the land's own lights: barricade rings round each camp (with ways in), its demon totem, boulders and low walls out in the open, logs at the wood's edge, rubble in the ruins with a ghost-fire brazier, burning wrecks, and demon obelisks far out. */
function cover(rng: Rng, base: Cell, ruins: Cell[], camps: Camp[], set: (c: Cell, g: Ground) => void, get: (c: Cell) => Ground): LandLight[] {
  const N = WORLD_SIZE, lights: LandLight[] = [];
  const inside = (c: Cell) => c.x > 1 && c.y > 1 && c.x < N - 2 && c.y < N - 2;
  const open = (c: Cell) => inside(c) && get(c) === 'grass' && near(c, base) > 11;
  const somewhere = (from: number, to: number, ok: (c: Cell) => boolean): Cell | undefined => {
    for (let t = 0; t < 60; t++) {
      const a = rng.next() * Math.PI * 2, d = rng.int(from, to);
      const c = { x: Math.round(base.x + Math.cos(a) * d), y: Math.round(base.y + Math.sin(a) * d) };
      if (ok(c)) return c;
    }
    return undefined;
  };
  for (const camp of camps) {
    // stakes and spikes on a ring, broken by three ways in (one toward the ship)
    const toShip = Math.atan2(base.y - camp.pos.y, base.x - camp.pos.x), gaps = [toShip, toShip + 2.1, toShip - 2.1];
    for (const c of ring(camp.pos, 5)) {
      const r = near(c, camp.pos), a = Math.atan2(c.y - camp.pos.y, c.x - camp.pos.x);
      const gap = gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.42);
      if (r >= 3.6 && r <= 4.4 && !gap && ['grass', 'forest', 'camp', 'tree'].includes(get(c))) set(c, 'barricade');
    }
    set(camp.totem, 'totem');
  }
  for (let n = 0; n < 16; n++) {
    const c = somewhere(12, 46, open);
    if (!c) continue;
    set(c, 'boulder');
    for (const d of ring(c, 1)) if (open(d) && rng.chance(0.3)) set(d, 'boulder');
  }
  for (let n = 0; n < 12; n++) {
    const c = somewhere(12, 46, open), along = rng.chance(0.5), len = rng.int(2, 4);
    if (!c) continue;
    for (let k = 0; k < len; k++) { const d = along ? { x: c.x + k, y: c.y } : { x: c.x, y: c.y + k }; if (open(d)) set(d, 'lowWall'); }
  }
  for (let n = 0; n < 12; n++) {
    const c = somewhere(12, 46, (x) => open(x) && ring(x, 1).some((d) => get(d) === 'tree'));
    if (c) set(c, 'log');
  }
  for (const r of ruins) {
    for (const c of ring(r, 3)) if (get(c) === 'ruin' && rng.chance(0.14)) set(c, 'lowWall');
    const b = ring(r, 2).find((c) => get(c) === 'ruin');
    if (b) { set(b, 'brazier'); lights.push({ pos: b, kind: 'brazier' }); }
  }
  for (let n = 0; n < 6; n++) {
    const c = somewhere(15, 44, open);
    if (c) { set(c, 'wreck'); lights.push({ pos: c, kind: 'wreck' }); }
  }
  for (let n = 0; n < 4; n++) {
    const c = somewhere(34, 46, open);
    if (c) { set(c, 'obelisk'); lights.push({ pos: c, kind: 'obelisk' }); }
  }
  return lights;
}

/** The crashed ship lies across the middle of the clearing. */
function ship(base: Cell, set: (c: Cell, g: Ground) => void): void {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -4; dx <= 3; dx++) if (!(Math.abs(dy) === 1 && (dx === -4 || dx === 3))) set({ x: base.x + dx, y: base.y + dy }, 'ship');
}

/** Every camp can be walked to from the base: a cut is made through trees, rocks and water where it cannot. */
export function connect(map: GridMap, ground: Ground[], goals: Cell[]): void {
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
