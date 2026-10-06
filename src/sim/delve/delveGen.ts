import { createRng, type Rng } from '../../core/rng';
import { distanceMap } from '../grid/path';
import { dist, idx, same, tileAt, walkable, type Cell, type FoeKind, type GridMap, type Room, type Tile } from '../grid/types';

export type RoomKind = 'start' | 'normal' | 'stairs' | 'vault' | 'shrine' | 'crypt' | 'ore' | 'den' | 'boss';
export interface DelveRoom { rect: Room; kind: RoomKind }
export interface ChestSpot { pos: Cell; tier: 1 | 2 | 3 }
export interface DelveFloor {
  map: GridMap;
  rooms: DelveRoom[];
  chests: ChestSpot[];
  ore: Cell[];
  shrine?: Cell;
  crypt?: Cell;
  boss: boolean;
}
export const DELVE_SIZE = 64;
const centre = (r: Room): Cell => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });
const inside = (r: Room, c: Cell): boolean => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h;
const overlaps = (a: Room, b: Room): boolean => a.x - 2 < b.x + b.w && b.x - 2 < a.x + a.w && a.y - 2 < b.y + b.h && b.y - 2 < a.y + a.h;

function placeRooms(rng: Rng): Room[] {
  const target = rng.int(16, 22), rooms: Room[] = [];
  for (let attempt = 0; attempt < 12000 && rooms.length < target; attempt++) {
    const max = attempt < 1000 ? 11 : 7;
    const w = rng.int(5, max), h = rng.int(5, max);
    const r = { x: rng.int(1, DELVE_SIZE - w - 1), y: rng.int(1, DELVE_SIZE - h - 1), w, h };
    if (!rooms.some((o) => overlaps(o, r))) rooms.push(r);
  }
  // A bounded fallback guarantees the minimum even for an unusually crowded packing.
  if (rooms.length < 16) {
    rooms.length = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) rooms.push({ x: 2 + x * 15, y: 2 + y * 15, w: rng.int(5, 11), h: rng.int(5, 11) });
  }
  const score = (r: Room) => (centre(r).x - DELVE_SIZE / 4) ** 2 + (centre(r).y - DELVE_SIZE / 2) ** 2;
  return rooms.sort((a, b) => score(a) - score(b));
}

function corridor(m: GridMap, a: Cell, b: Cell, horizontal: boolean): Cell[] {
  const mid = horizontal ? { x: b.x, y: a.y } : { x: a.x, y: b.y }, cells: Cell[] = [];
  for (const [p, q] of [[a, mid], [mid, b]] as const) {
    const dx = Math.sign(q.x - p.x), dy = Math.sign(q.y - p.y);
    for (let c = { ...p }; ; c = { x: c.x + dx, y: c.y + dy }) {
      m.tiles[idx(m, c)] = 'floor';
      if (!cells.some((o) => same(o, c))) cells.push(c);
      if (same(c, q)) break;
    }
  }
  return cells;
}

/** Same outer-ring door rule as the grid generator, kept independent of it. */
function addDoors(m: GridMap): void {
  for (const r of m.rooms) for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
    if (inside(r, { x, y }) || tileAt(m, { x, y }) !== 'floor') continue;
    const wall = (dx: number, dy: number) => tileAt(m, { x: x + dx, y: y + dy }) === 'wall';
    if ((wall(1, 0) && wall(-1, 0)) || (wall(0, 1) && wall(0, -1))) m.tiles[idx(m, { x, y })] = 'door';
  }
}

function cellsOf(m: GridMap, r: Room, taken: Set<number>, margin = 0): Cell[] {
  const cells: Cell[] = [];
  for (let y = r.y + margin; y < r.y + r.h - margin; y++) for (let x = r.x + margin; x < r.x + r.w - margin; x++) {
    if (tileAt(m, { x, y }) === 'floor' && !taken.has(idx(m, { x, y }))) cells.push({ x, y });
  }
  return cells;
}

function layout(rng: Rng): { map: GridMap; corridors: Cell[][] } {
  const rooms = placeRooms(rng);
  const map: GridMap = { w: DELVE_SIZE, h: DELVE_SIZE, tiles: new Array<Tile>(DELVE_SIZE ** 2).fill('wall'), rooms, start: centre(rooms[0]!), exits: [], chests: [], spawns: [], traps: [] };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.tiles[idx(map, { x, y })] = 'floor';
  const corridors: Cell[][] = [], links = new Set<string>();
  for (let i = 1; i < rooms.length; i++) {
    // Each new room joins one already connected room: a spanning tree.
    const j = rng.int(0, i - 1);
    links.add(`${j}:${i}`);
    corridors.push(corridor(map, centre(rooms[j]!), centre(rooms[i]!), rng.chance(0.5)));
  }
  const extras: [number, number][] = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (!links.has(`${i}:${j}`)) extras.push([i, j]);
  for (const [i, j] of rng.shuffle(extras).slice(0, rng.int(2, 3))) corridors.push(corridor(map, centre(rooms[i]!), centre(rooms[j]!), rng.chance(0.5)));
  addDoors(map);
  const reserved = new Set(rooms.map((r) => idx(map, centre(r))));
  // placeParty uses a two-column formation; also keep the lift's immediate approaches open.
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 2; x++) reserved.add(idx(map, { x: map.start.x + x, y: map.start.y + y }));
  for (const r of rooms) if (r.w >= 7 && r.h >= 7) {
    for (const c of rng.shuffle(cellsOf(map, r, reserved, r === rooms[0] ? 1 : 2)).slice(0, rng.int(1, 2))) map.tiles[idx(map, c)] = 'pillar';
  }
  return { map, corridors };
}

function roles(map: GridMap, rng: Rng, floor: number): DelveRoom[] {
  const d = distanceMap(map, map.start);
  const deepest = map.rooms.reduce((best, r, i) => d[idx(map, centre(r))]! > d[idx(map, centre(map.rooms[best]!))]! ? i : best, 0);
  const rooms: DelveRoom[] = map.rooms.map((rect, i) => ({ rect, kind: i === 0 ? 'start' : i === deepest ? (floor % 5 === 0 ? 'boss' : 'stairs') : 'normal' }));
  map.stairs = centre(map.rooms[deepest]!);
  const pool = rng.shuffle(rooms.filter((r) => r.kind === 'normal'));
  const assign = (kind: RoomKind) => { pool.pop()!.kind = kind; };
  assign('vault'); assign('den');
  for (let n = rng.int(1, 2); n > 0; n--) assign('ore');
  if (rng.chance(0.5)) assign('shrine');
  if (floor >= 2 && rng.chance(0.4)) assign('crypt');
  return rooms;
}

function oreSpots(f: DelveFloor, rng: Rng): boolean {
  const m = f.map;
  for (const { rect: r, kind } of f.rooms) if (kind === 'ore') {
    const boundary = cellsOf(m, r, new Set()).filter((c) => (c.x === r.x || c.x === r.x + r.w - 1 || c.y === r.y || c.y === r.y + r.h - 1) &&
      ![{ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 }].some((n) => !inside(r, n) && walkable(tileAt(m, n))));
    for (const c of rng.shuffle(boundary).slice(0, rng.int(3, 5))) { m.tiles[idx(m, c)] = 'pillar'; f.ore.push(c); }
  }
  // Ore is solid. Validate roles against the final walking graph, not the earlier layout.
  const d = distanceMap(m, m.start), end = d[idx(m, m.stairs!)]!;
  return f.rooms.every(({ rect }) => { const n = d[idx(m, centre(rect))]!; return n >= 0 && n <= end; });
}

function foeKind(rng: Rng, floor: number): FoeKind {
  if (floor >= 3) {
    const n = rng.next();
    if (n < 0.15) return 'brute';
    if (n < 0.30) return 'ghoul';
    if (n < 0.40) return 'mage';
  }
  return rng.chance(0.65) ? 'minion' : 'archer';
}

function contents(f: DelveFloor, floor: number, loot: Rng, spawns: Rng): void {
  const m = f.map, taken = new Set<number>([idx(m, m.start), idx(m, m.stairs!)]);
  f.rooms.forEach(({ rect, kind }, group) => {
    const c = centre(rect);
    if (kind === 'shrine') { f.shrine = c; taken.add(idx(m, c)); }
    if (kind === 'crypt') { f.crypt = c; taken.add(idx(m, c)); }
    const tier = kind === 'vault' ? 3 : kind === 'den' ? 2 : kind === 'normal' && loot.chance(0.25) ? 1 : undefined;
    if (tier) {
      const pos = loot.pick(cellsOf(m, rect, taken));
      f.chests.push({ pos, tier }); m.chests.push(pos); taken.add(idx(m, pos));
    }
    const count = kind === 'normal' ? spawns.int(1, 3) + (floor >= 4 ? 1 : 0) : kind === 'den' ? spawns.int(4, 5) : kind === 'crypt' || kind === 'vault' ? 2 : kind === 'boss' ? 3 : 0;
    const cells = spawns.shuffle(cellsOf(m, rect, taken).filter((pos) => dist(pos, m.start) > 6));
    for (let i = 0; i < count; i++) {
      const pos = cells.pop()!;
      const elite = kind === 'den' ? i < 2 : kind === 'crypt' && i === 0;
      m.spawns.push({ pos, group, kind: kind === 'boss' ? (i === 0 ? 'champion' : 'brute') : foeKind(spawns, floor), ...(elite ? { elite: true } : {}) });
      taken.add(idx(m, pos));
    }
  });
}

/** Independent streams keep content rolls from consuming layout/combat randomness. */
export function generateFloor(seed: number, floor: number): DelveFloor {
  const layoutRng = createRng((seed ^ 0x9e3779b9) + floor * 7919);
  const loot = createRng((seed ^ 0x10a7) + floor * 3571);
  const spawns = createRng((seed ^ 0x5a11) + floor * 6151);
  const traps = createRng((seed ^ 0x51ed27) + floor * 104729);
  for (;;) {
    const { map, corridors } = layout(layoutRng);
    const rooms = roles(map, layoutRng, floor);
    const f: DelveFloor = { map, rooms, chests: [], ore: [], boss: floor % 5 === 0 };
    if (!oreSpots(f, layoutRng)) continue;
    const eligible: Cell[][] = [];
    for (const corridor of corridors) {
      let run: Cell[] = [];
      for (const c of corridor) {
        if (!map.rooms.some((r) => inside(r, c)) && tileAt(map, c) === 'floor') run.push(c);
        else { if (run.length >= 6) eligible.push(run); run = []; }
      }
      if (run.length >= 6) eligible.push(run);
    }
    if (!eligible.length) continue;
    contents(f, floor, loot, spawns);
    const trapped = new Set<number>();
    for (const cells of traps.shuffle(eligible).slice(0, traps.int(1, 2))) {
      const pool = traps.shuffle(cells.filter((c) => !trapped.has(idx(map, c))));
      if (pool.length < 6) continue;
      const count = traps.int(2, 4);
      for (const pos of pool.slice(0, count)) { map.traps!.push({ pos, kind: 'spike', found: false }); trapped.add(idx(map, pos)); }
      if (floor >= 3 && pool[count]) { const pos = pool[count]!; map.traps!.push({ pos, kind: 'alarm', found: false }); trapped.add(idx(map, pos)); }
    }
    return f;
  }
}
