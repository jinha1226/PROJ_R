import { addBuff } from './buffs';
import { noise } from './danger';
import { applyElement, hurt } from './status';
import { dist, idx, same, tileAt, type Cell, type Ent, type GridState } from './types';

const ALARM_RANGE = 12;
const FIRE: [number, number] = [3, 6];
const TELEPORT_MIN = 8;
const ROOT_TURNS = 2;
const SPOT_CHANCE = 0.2;
const SEARCH_RANGE = 2;

/** A free floor cell at least `min` cells from `from` (no body, chest, barrel, trap or stairs); null if none. */
export function farCell(s: GridState, from: Cell, min: number): Cell | null {
  const out: Cell[] = [];
  for (let y = 0; y < s.map.h; y++) for (let x = 0; x < s.map.w; x++) {
    const c = { x, y };
    if (tileAt(s.map, c) !== 'floor' || dist(c, from) < min) continue;
    if ([s.hero, ...s.foes].some((e) => e.alive && same(e.pos, c)) || s.chests.some((ch) => same(ch.pos, c)) || s.barrels.some((b) => same(b, c))) continue;
    if (s.traps.some((tr) => same(tr.pos, c)) || (s.map.stairs && same(c, s.map.stairs)) || s.tiles.some((tl) => same(tl.pos, c))) continue;
    out.push(c);
  }
  return out.length ? s.rng.pick(out) : null;
}

/** Moves someone to a far free cell (a teleport trap or scroll). */
export function teleport(s: GridState, e: Ent, t: number): void {
  const to = farCell(s, e.pos, TELEPORT_MIN);
  if (!to) return;
  s.events.push({ t, type: 'teleport', src: e.id, from: { ...e.pos }, to: { ...to } });
  e.pos = to;
}

/** Whoever steps on a trap sets it off; it is spent (found or not). */
export function springTrap(s: GridState, e: Ent, t: number): void {
  const i = s.traps.findIndex((x) => same(x.pos, e.pos));
  if (i < 0) return;
  const trap = s.traps.splice(i, 1)[0]!;
  const at = trap.pos;
  const floor = s.run.floor;
  s.events.push({ t, type: 'trap', src: e.id, to: { ...at }, text: trap.kind });
  switch (trap.kind) {
    case 'spike': hurt(s, t, 'trap', e, s.rng.int(3 + 2 * floor, 6 + 2 * floor), 'spike'); break;
    case 'alarm':
      noise(s, at, ALARM_RANGE, true);
      for (const f of s.foes) if (f.alive && dist(f.pos, at) <= ALARM_RANGE) f.lastSeen = { ...at };
      break;
    case 'poison': applyElement(s, t, 'poison', at, 1, null, 'trap'); break;
    case 'fire': applyElement(s, t, 'fire', at, 1, FIRE, 'trap'); break;
    case 'teleport': teleport(s, e, t); break;
    case 'net':
      if (e.id === s.hero.id) addBuff(s, e, 'root', ROOT_TURNS, t);
      else e.stun = Math.max(e.stun ?? 0, 1);
      break;
  }
}

function reveal(s: GridState, t: number, near: number, chance: number): void {
  for (const tr of s.traps) {
    if (tr.found || dist(tr.pos, s.hero.pos) > near || (chance < 1 && !s.rng.chance(chance))) continue;
    tr.found = true;
    s.events.push({ t, type: 'trapFound', src: s.hero.id, to: { ...tr.pos }, text: tr.kind });
  }
}

/** After each hero action: a hidden trap beside the hero is noticed one time in five. */
export const discover = (s: GridState, t: number): void => reveal(s, t, 1, SPOT_CHANCE);

/** Searching (one turn) finds every trap within two cells. */
export const search = (s: GridState, t: number): void => reveal(s, t, SEARCH_RANGE, 1);

/** Traps for one floor: on open floor away from the start, doorways, stairs and anything placed. */
export function placeTraps(m: { w: number; h: number; tiles: string[]; start: Cell; stairs?: Cell }, taken: Set<number>, rng: { int(a: number, b: number): number; pick<T>(a: readonly T[]): T; shuffle<T>(a: T[]): T[] }, floor: number) {
  const KINDS = ['spike', 'spike', 'spike', 'net', 'net', 'poison', 'poison', 'fire', 'fire', 'alarm', 'alarm', 'teleport'] as const;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? 'wall' : m.tiles[y * m.w + x]);
  const cells: Cell[] = [];
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    const c = { x, y };
    const byDoor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx!, y + dy!) === 'door');
    if (at(x, y) !== 'floor' || byDoor || taken.has(idx(m, c)) || dist(c, m.start) <= 3 || (m.stairs && dist(c, m.stairs) <= 1)) continue;
    cells.push(c);
  }
  return rng.shuffle(cells).slice(0, 3 + floor).map((pos) => ({ pos, kind: rng.pick(KINDS), found: false }));
}
