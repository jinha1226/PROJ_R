import { isBossFloor } from './zones';
import { placeTraps } from './traps';
import { createRng, type Rng } from '../../core/rng';
import { spawnKind } from './foes';
import { distanceMap } from './path';
import { idx, tileAt, type Cell, type GridMap, type Room, type Tile } from './types';

const SIZE = 48;
const MAX_ROOMS = 12;

const centre = (r: Room): Cell => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });
const inside = (r: Room, c: Cell): boolean => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h;
const overlaps = (a: Room, b: Room, gap: number): boolean =>
  a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h;

function placeRooms(rng: Rng): Room[] {
  const rooms: Room[] = [];
  for (let tries = 0; tries < 400 && rooms.length < MAX_ROOMS; tries++) {
    const w = rng.int(5, 9);
    const h = rng.int(5, 9);
    const r = { x: rng.int(1, SIZE - w - 1), y: rng.int(1, SIZE - h - 1), w, h };
    if (!rooms.some((o) => overlaps(o, r, 2))) rooms.push(r);
  }
  return rooms.sort((a, b) => a.x - b.x);
}

function carve(tiles: Tile[], c: Cell): void {
  tiles[c.y * SIZE + c.x] = 'floor';
}

/** L-shaped one-wide corridor between two room centres. */
function corridor(tiles: Tile[], a: Cell, b: Cell, horizontalFirst: boolean): void {
  const mid = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  for (const [p, q] of [[a, mid], [mid, b]] as const) {
    const sx = Math.sign(q.x - p.x);
    const sy = Math.sign(q.y - p.y);
    for (let c = { ...p }; ; c = { x: c.x + sx, y: c.y + sy }) {
      carve(tiles, c);
      if (c.x === q.x && c.y === q.y) break;
    }
  }
}

/** A corridor cell on a room's outer ring with walls on both sides becomes a door. */
function addDoors(m: GridMap): void {
  for (const r of m.rooms) for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
    if (inside(r, { x, y }) || tileAt(m, { x, y }) !== 'floor') continue;
    const wall = (dx: number, dy: number) => tileAt(m, { x: x + dx, y: y + dy }) === 'wall';
    if ((wall(1, 0) && wall(-1, 0)) || (wall(0, 1) && wall(0, -1))) m.tiles[idx(m, { x, y })] = 'door';
  }
}

function freeCells(m: GridMap, r: Room, taken: Set<number>, margin: number): Cell[] {
  const out: Cell[] = [];
  for (let y = r.y + margin; y < r.y + r.h - margin; y++) for (let x = r.x + margin; x < r.x + r.w - margin; x++) {
    const c = { x, y };
    if (tileAt(m, c) === 'floor' && !taken.has(idx(m, c))) out.push(c);
  }
  return out;
}

/** One crypt floor: rooms joined by corridors, doors, pillars, a start room, the two farthest rooms as exits, chests and sleeping foes. */
export function generateMap(seed: number, floor = 1): GridMap {
  const rng = createRng((seed ^ 0x9e3779b9) + floor * 7919);
  const tiles: Tile[] = new Array<Tile>(SIZE * SIZE).fill('wall');
  const rooms = placeRooms(rng);
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(tiles, { x, y });
  for (let i = 1; i < rooms.length; i++) corridor(tiles, centre(rooms[i - 1]!), centre(rooms[i]!), rng.chance(0.5));
  const m: GridMap = { w: SIZE, h: SIZE, tiles, rooms, start: centre(rooms[0]!), exits: [], chests: [], spawns: [], barrels: [] };
  addDoors(m);
  const taken = new Set<number>(rooms.map((r) => idx(m, centre(r))));
  for (const r of rooms) {
    if (r.w < 7 || r.h < 7) continue;
    for (let n = rng.int(1, 2); n > 0; n--) {
      const c = rng.pick(freeCells(m, r, taken, 2));
      m.tiles[idx(m, c)] = 'pillar';
      taken.add(idx(m, c));
    }
  }
  const d = distanceMap(m, m.start);
  const far = rooms.slice(1).map((r) => ({ r, d: d[idx(m, centre(r))]! })).filter((x) => x.d > 0).sort((a, b) => b.d - a.d);
  // the deepest room holds stairs, or a champion at the end of a zone
  const deepest = far[0]?.r;
  if (deepest && !isBossFloor(floor)) m.stairs = centre(deepest);
  if (deepest && isBossFloor(floor)) m.spawns.push({ kind: 'champion', pos: centre(deepest), group: rooms.indexOf(deepest) });
  rooms.slice(1).forEach((r, i) => {
    // the champion's room holds nothing else
    if (isBossFloor(floor) && r === deepest) return;
    const cells = rng.shuffle(freeCells(m, r, taken, 0));
    const byDoor = (c: Cell) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(m, { x: c.x + dx!, y: c.y + dy! }) === 'door');
    const spot = cells.findIndex((c) => !byDoor(c));
    if (rng.chance(0.6) && spot >= 0) {
      const c = cells.splice(spot, 1)[0]!;
      m.chests.push(c);
      taken.add(idx(m, c));
    }
    // oil barrels: away from doors so they never plug a doorway
    m.barrels ??= [];
    for (let n = rng.int(0, 2); n > 0; n--) {
      const k = cells.findIndex((c) => !byDoor(c));
      if (k < 0) break;
      const c = cells.splice(k, 1)[0]!;
      m.barrels.push(c);
      taken.add(idx(m, c));
    }
    for (let n = rng.int(1, 3); n > 0 && cells.length; n--) {
      const kind = spawnKind(rng, floor);
      const c = cells.pop()!;
      m.spawns.push({ kind, pos: c, group: i + 1 });
      taken.add(idx(m, c));
    }
  });
  // traps roll on their own stream so the rest of the floor stays as it was
  m.traps = placeTraps(m, taken, createRng((seed ^ 0x51ed27) + floor * 104729), floor);
  // Elite selection has its own stream and cannot disturb floor contents.
  if (!isBossFloor(floor)) {
    const elites = createRng((seed ^ 0x3e11a7) + floor * 6151);
    const count = elites.int(1, 2);
    const pool = elites.shuffle(m.spawns.filter((sp) => sp.kind !== 'champion'));
    for (const sp of pool.slice(0, count)) sp.elite = true;
  }
  return m;
}
