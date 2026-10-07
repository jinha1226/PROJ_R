import { roomStep, setupRooms } from './delveRooms';
import type { Item } from './items';
import { starterGear, nextItemId } from '../delve/gear';
import { createRng } from '../../core/rng';
import { rollMemory } from '../party/memories';
import { generateFloor, type ChestSpot, type DelveRoom, type DelveFloor } from './delveGen';
import { distanceMap } from '../grid/path';
import { newState } from '../grid/state';
import { dist, idx, type Cell, type GEvent, type GridMap } from '../grid/types';
import { entOf } from '../party/partyCore';
import { hasMemory } from '../party/body';
import { BASE_CLASSES, CLASSES, FOES, type BaseClass, type FoeId } from '../party/partyDefs';
import { tick } from '../party/partySim';
import { blank, hpNow, living, look, roamStep, type RoamParty, type Soul } from '../roam/roam';
import { placeParty, takeParty, type Carry } from '../roam/carry';
import { beaconStep, type Beacon } from './beacon';

export const DELVE_SIGHT = 8;
/** the dungeon's kinds, as the party knows them */
const FOE_OF: Record<string, FoeId> = { minion: 'goblin', ghoul: 'ghoul', archer: 'archer', mage: 'shaman', brute: 'brute', champion: 'warlord' };

export interface DelveParty extends RoamParty { floor: number; deepest: number; seed: number; rooms: DelveRoom[]; chests: (ChestSpot & { opened: boolean })[]; oreNodes: { pos: Cell; left: number; progress: number }[]; shrine?: { pos: Cell; used: boolean }; floorItems: { pos: Cell; item: Item }[]; boss: boolean; roomTime: number; lootReaped: Set<string>; handledMoves: WeakSet<GEvent>;
  /** the return beacon: a portal opening, whether this floor's use is spent, where a clone comes back down to */
  beacon?: Beacon; beaconUsed: boolean; beaconAt?: Cell;
  /** the portal opened and the clone is on its way up: the floor waits as it is */
  left?: boolean }

/** Ordinary souls belong to normal rooms; an unclassed first arrival gets an archer by the lift. */
function placeSouls(f: DelveFloor, seed: number, floor: number, firstArcher: boolean): Soul[] {
  const map = f.map;
  const rng = createRng((seed ^ 0x50a1) + floor * 131);
  const d = distanceMap(map, map.start);
  const free = (c: Cell) => map.tiles[idx(map, c)] === 'floor' && d[idx(map, c)]! > 0 && !map.spawns.some((s) => s.pos.x === c.x && s.pos.y === c.y) && !map.chests.some((s) => s.x === c.x && s.y === c.y);
  const cellsOf = (r: GridMap['rooms'][number]) => { const out: Cell[] = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (free({ x, y })) out.push({ x, y }); return out; };
  const rooms = f.rooms.filter((r) => r.kind === 'normal').map((r) => r.rect).sort((a, b) => d[idx(map, { x: a.x + (a.w >> 1), y: a.y + (a.h >> 1) })]! - d[idx(map, { x: b.x + (b.w >> 1), y: b.y + (b.h >> 1) })]!);
  const spots: Cell[] = [];
  const first = cellsOf(map.rooms[0]!).filter((c) => dist(c, map.start) >= 2);
  if (firstArcher && first.length) spots.push(rng.pick(first));
  for (const r of rng.shuffle(rooms).slice(0, (floor === 1 ? 4 : 3) - spots.length)) { const c = cellsOf(r); if (c.length) spots.push(rng.pick(c)); }
  const order: BaseClass[] = floor === 1 ? ['archer', ...rng.shuffle(BASE_CLASSES.filter((c) => c !== 'archer'))] : rng.shuffle([...BASE_CLASSES]);
  return spots.map((pos, id) => ({ id, pos, cls: order[id % order.length]!, taken: false, memory: rollMemory(rng) }));
}

/** Fills a fresh state with a floor's sleeping bands (a room's band wakes together); deeper floors are tougher. */
function populate(p: DelveParty): void {
  const m = p.s.map, scale = 1 + 0.15 * (p.floor - 1);
  p.s.foes.forEach((e, i) => {
    const sp = m.spawns[i]!, kind = FOE_OF[e.kind] ?? 'goblin';
    e.hp = e.maxHp = Math.round(FOES[kind].hp * scale * (sp.elite ? 1.8 : 1));
    p.units.push({ ...blank(), id: e.id, side: 'foe', foe: kind, foeScale: scale, asleep: true, group: sp.group, nextAt: 0.15 * i });
  });
}

/** An empty clone steps out of the lift on the first floor below the ship. */
export function newDelve(seed = 1, floor = 1, carry?: Carry): DelveParty {
  const generated = generateFloor(seed, floor), map = generated.map;
  const s = newState(map, seed + floor * 31, 'pistol', floor);
  s.hero.hp = s.hero.maxHp = CLASSES.shell.hp; s.hero.awake = false;
  const p: DelveParty = { s, units: [], time: 0, wave: 0, combat: false, leader: 'hero', roam: true, sight: DELVE_SIGHT, souls: placeSouls(generated, seed, floor, floor === 1 && !carry?.clones.some((c) => c.unit.cls && c.unit.cls !== 'shell')), rooms: [], chests: [], oreNodes: [], floorItems: [], boss: false, roomTime: 0, lootReaped: new Set(), handledMoves: new WeakSet(), beaconUsed: false, ore: 0, crystal: 0, foundHeroes: [], carried: [], pack: [{id:'item-1',consumable:'potion'},{id:'item-2',consumable:'potion'}], nextItem: 3, nextClone: 1, bio: 0, printHere: false, base: { ...map.start }, deepest: Math.max(floor, carry?.deepest ?? floor), floor, seed };
  p.units.push({ ...blank(), id: 'hero', side: 'hero', cls: 'shell', weapon: 'pistol', gear: starterGear('shell', () => nextItemId(p)) });
  populate(p);
  if (carry) placeParty(p, carry);
  setupRooms(p, generated);
  look(p);
  return p;
}

/** Time runs on a dungeon floor: the clones act, then the roaming rules. */
export function delveTick(p: DelveParty, dt: number): GEvent[] {
  if (p.left) return [];
  const before = new Map(p.units.map((u) => [u.id, { ...entOf(p, u.id)!.pos }]));
  const hp = hpNow(p);
  const ev = tick(p, dt);
  roamStep(p, hp, ev);
  roomStep(p, before, ev);
  beaconStep(p, ev);
  return ev;
}

/** The whole living party is by the stairs and nothing is hunting it. */
export const canDescend = (p: DelveParty): boolean => !p.left && !(p.boss && p.units.some((u) => u.foe === 'warlord' && entOf(p, u.id)?.alive)) && !p.combat && !!p.s.map.stairs && living(p).length > 0 && living(p).every((u) => dist(entOf(p, u.id)!.pos, p.s.map.stairs!) <= 1);

/** Down the stairs: a new floor; the living clones come along as they are (the fallen and their unrecovered souls stay behind). */
export function descend(p: DelveParty): boolean {
  if (!canDescend(p)) return false;
  const carry = takeParty(p), floor = p.floor + 1, generated = generateFloor(p.seed, floor), map = generated.map;
  p.s = newState(map, p.seed + floor * 31, 'pistol', floor);
  p.deepest = Math.max(p.deepest, floor);
  p.beacon = undefined; p.beaconUsed = false; p.beaconAt = undefined;
  p.floor = floor; p.units = []; p.souls = placeSouls(generated, p.seed, floor, false); p.base = { ...map.start };
  populate(p);
  placeParty(p, carry);
  // the pilgrim's memory: a new floor, whole again
  for (const u of living(p)) if (hasMemory(u, 'pilgrim')) { const e = entOf(p, u.id)!; e.hp = e.maxHp; }
  setupRooms(p, generated);
  return true;
}

/** The whole living party is back at the lift and nothing hunts it: they can ride up to the pod. */
export const canAscend = (p: DelveParty): boolean => !p.left && !p.combat && living(p).length > 0 && living(p).every((u) => dist(entOf(p, u.id)!.pos, p.base) <= 2);

/** A clone comes back down to the kept floor, at the beacon spot (the floor's state is as it was left). */
export function reenter(p: DelveParty, c: Carry): void {
  placeParty(p, c);
  p.left = false;
  const at = p.beaconAt ?? p.base;
  for (const u of living(p)) entOf(p, u.id)!.pos = { ...at };
  look(p);
}
