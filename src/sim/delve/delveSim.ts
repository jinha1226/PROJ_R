import { createRng } from '../../core/rng';
import { spawnFoe } from '../grid/foes';
import { generateMap } from '../grid/mapgen';
import { distanceMap } from '../grid/path';
import { newState } from '../grid/state';
import { dist, idx, type Cell, type GEvent, type GridMap } from '../grid/types';
import { entOf, type Unit } from '../party/partyCore';
import { BASE_CLASSES, CLASSES, FOES, type BaseClass, type FoeId } from '../party/partyDefs';
import { tick } from '../party/partySim';
import { blank, hpNow, living, look, roamStep, type RoamParty, type Soul } from '../roam/roam';

export const DELVE_SIGHT = 8;
/** the dungeon's kinds, as the party knows them */
const FOE_OF: Record<string, FoeId> = { minion: 'goblin', ghoul: 'goblin', archer: 'archer', mage: 'archer', brute: 'brute', champion: 'brute' };

export interface DelveParty extends RoamParty { floor: number; seed: number }

/** Soul stones on a floor: the first (an archer on floor 1) in the room the lift opens into, the rest in rooms farther in; the nearest three differ. */
function placeSouls(map: GridMap, seed: number, floor: number): Soul[] {
  const rng = createRng((seed ^ 0x50a1) + floor * 131);
  const d = distanceMap(map, map.start);
  const free = (c: Cell) => map.tiles[idx(map, c)] === 'floor' && d[idx(map, c)]! > 0 && !map.spawns.some((s) => s.pos.x === c.x && s.pos.y === c.y);
  const cellsOf = (r: GridMap['rooms'][number]) => { const out: Cell[] = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (free({ x, y })) out.push({ x, y }); return out; };
  const rooms = [...map.rooms].sort((a, b) => d[idx(map, { x: a.x + (a.w >> 1), y: a.y + (a.h >> 1) })]! - d[idx(map, { x: b.x + (b.w >> 1), y: b.y + (b.h >> 1) })]!);
  const spots: Cell[] = [];
  const first = cellsOf(rooms[0]!).filter((c) => dist(c, map.start) >= 2);
  if (first.length) spots.push(rng.pick(first));
  for (const r of rng.shuffle(rooms.slice(2)).slice(0, floor === 1 ? 3 : 2)) { const c = cellsOf(r); if (c.length) spots.push(rng.pick(c)); }
  const order: BaseClass[] = floor === 1 ? ['archer', ...rng.shuffle(BASE_CLASSES.filter((c) => c !== 'archer'))] : rng.shuffle([...BASE_CLASSES]);
  return spots.map((pos, id) => ({ id, pos, cls: order[id % order.length]!, taken: false }));
}

/** Fills a fresh state with a floor's sleeping bands (a room's band wakes together); deeper floors are tougher. */
function populate(p: DelveParty): void {
  const m = p.s.map, scale = 1 + 0.15 * (p.floor - 1);
  p.s.foes.forEach((e, i) => {
    const sp = m.spawns[i]!, kind = FOE_OF[e.kind] ?? 'goblin';
    e.hp = e.maxHp = Math.round(FOES[kind].hp * scale * (sp.elite || e.kind === 'champion' ? 1.8 : 1));
    p.units.push({ ...blank(), id: e.id, side: 'foe', foe: kind, asleep: true, group: sp.group, nextAt: 0.15 * i });
  });
}

function floorMap(seed: number, floor: number): GridMap {
  const m = generateMap(seed, floor);
  // the party has no use (yet) for chests, barrels and hidden traps: keep the floor clean
  return { ...m, chests: [], barrels: [], traps: [] };
}

/** An empty clone steps out of the lift on the first floor below the ship. */
export function newDelve(seed = 1, floor = 1): DelveParty {
  const map = floorMap(seed, floor);
  const s = newState(map, seed + floor * 31, 'pistol', floor);
  s.hero.hp = s.hero.maxHp = CLASSES.shell.hp; s.hero.awake = false;
  const p: DelveParty = { s, units: [], time: 0, wave: 0, combat: false, leader: 'hero', roam: true, sight: DELVE_SIGHT, souls: placeSouls(map, seed, floor), carried: [], nextClone: 1, base: { ...map.start }, floor, seed };
  p.units.push({ ...blank(), id: 'hero', side: 'hero', cls: 'shell', weapon: 'fists' });
  populate(p);
  look(p);
  return p;
}

/** Time runs on a dungeon floor: the clones act, then the roaming rules. */
export function delveTick(p: DelveParty, dt: number): GEvent[] {
  const hp = hpNow(p);
  const ev = tick(p, dt);
  roamStep(p, hp, ev);
  return ev;
}

/** The whole living party is by the stairs and nothing is hunting it. */
export const canDescend = (p: DelveParty): boolean => !p.combat && !!p.s.map.stairs && living(p).length > 0 && living(p).every((u) => dist(entOf(p, u.id)!.pos, p.s.map.stairs!) <= 1);

/** Down the stairs: a new floor; the living clones come along as they are (the fallen and their unrecovered souls stay behind). */
export function descend(p: DelveParty): boolean {
  if (!canDescend(p)) return false;
  const keep = living(p).map((u) => ({ u, hp: entOf(p, u.id)!.hp, maxHp: entOf(p, u.id)!.maxHp }));
  const floor = p.floor + 1, map = floorMap(p.seed, floor);
  const s = newState(map, p.seed + floor * 31, 'pistol', floor);
  p.s = s; p.floor = floor; p.units = []; p.souls = placeSouls(map, p.seed, floor); p.base = { ...map.start }; p.combat = false; p.waiting = false;
  // the first clone keeps the hero's place in the state; if it fell, that slot lies empty off the map
  if (!keep.some((k) => k.u.id === 'hero')) { s.hero.alive = false; s.hero.pos = { x: -50, y: -50 }; }
  keep.forEach((k, i) => {
    const at = { x: map.start.x + (i % 2), y: map.start.y + (i >> 1) };
    const e = k.u.id === 'hero' ? s.hero : spawnFoe(s, 'minion', at, false);
    e.id = k.u.id; e.pos = at; e.hp = k.hp; e.maxHp = k.maxHp; e.awake = false;
    const u: Unit = { ...k.u, order: null, queued: undefined, nextAt: p.time, ready: [p.time, p.time] };
    p.units.push(u);
  });
  // foes come after the clones in the list; their spawns start the foe list of the new state
  const clonesFirst = s.foes.filter((f) => keep.some((k) => k.u.id === f.id));
  s.foes = s.foes.filter((f) => !clonesFirst.includes(f));
  populate(p);
  s.foes.push(...clonesFirst);
  look(p);
  return true;
}
