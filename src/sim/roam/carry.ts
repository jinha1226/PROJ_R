import type { Item } from '../delve/items';
import { spawnFoe } from '../grid/foes';
import { same, tileAt, walkable, type Cell } from '../grid/types';
import { alive, entOf, type Unit } from '../party/partyCore';
import type { CarriedSoul, HeroSoulId } from '../delve/heroSouls';
import { living, look, type RoamParty } from './roam';

/** What goes up and down the shaft with the party: the living clones as they are, the souls carried, the bio-matter, the next clone's number. */
export interface Carry { deepest?: number; time: number; pack: Item[]; nextItem: number; clones: { unit: Unit; hp: number; maxHp: number }[]; carried: CarriedSoul[]; ore: number; crystal: number; foundHeroes: HeroSoulId[]; bio: number; nextClone: number }

export function takeParty(p: RoamParty): Carry {
  return { deepest: p.deepest, time: p.time, pack: structuredClone(p.pack), nextItem: p.nextItem, clones: living(p).map((u) => ({ unit: { ...structuredClone(u), shield: 0 }, hp: entOf(p, u.id)!.hp, maxHp: entOf(p, u.id)!.maxHp })), ore: p.ore, crystal: p.crystal, foundHeroes: [...p.foundHeroes], carried: structuredClone(p.carried), bio: p.bio, nextClone: p.nextClone };
}

/** Puts a party that came up or down the shaft beside the map's start (the first clone keeps the hero's place in the state; if it fell, that slot lies empty off the map). */
export function placeParty(p: RoamParty, c: Carry): void {
  const s = p.s, m = s.map;
  for (const u of p.units) if (u.side === 'hero' && u.id !== 'hero') { const e = entOf(p, u.id); if (e) e.alive = false; }
  s.foes = s.foes.filter((f) => !p.units.some((u) => u.side === 'hero' && u.id === f.id));
  p.units = p.units.filter((u) => u.side !== 'hero');
  if (!c.clones.some((k) => k.unit.id === 'hero')) { s.hero.alive = false; s.hero.pos = { x: -50, y: -50 }; }
  const heroes = c.clones.map((k, i) => {
    const at = { x: m.start.x + (i % 2), y: m.start.y + (i >> 1) };
    const e = k.unit.id === 'hero' ? s.hero : spawnFoe(s, 'minion', at, false);
    e.id = k.unit.id; e.pos = at; e.hp = k.hp; e.maxHp = k.maxHp; e.alive = true; e.awake = false;
    const unit = structuredClone(k.unit), shift = p.time-c.time;
    shiftUnitTimes(unit, shift);
    return { ...unit, shield: 0, order: null, queued: undefined } as Unit;
  });
  p.units = [...heroes, ...p.units];
  p.pack = structuredClone(c.pack); p.nextItem = c.nextItem;
  p.ore = c.ore; p.crystal = c.crystal; p.foundHeroes = [...c.foundHeroes];
  p.carried = structuredClone(c.carried); p.bio = c.bio; p.nextClone = c.nextClone;
  p.combat = false; p.waiting = false; p.manual = undefined; p.over = false; p.rewakeAt = undefined;
  p.leader = c.clones[0]?.unit.id ?? 'hero';
  look(p);
}

/** One clone leaves for the dungeon: it alone goes in the carry (souls stay stored at the base); it is taken off this map. */
export function takeClone(p: RoamParty, id: string): Carry {
  const all = takeParty(p), c = { ...all, clones: all.clones.filter((k) => k.unit.id === id).map((k) => ({ ...k, unit: { ...k.unit, wentDown: true } })), carried: [] };
  const e = entOf(p, id);
  if (e) { e.alive = false; e.pos = { x: -50, y: -50 }; }
  if (id !== 'hero') p.s.foes = p.s.foes.filter((f) => f.id !== id);
  p.units = p.units.filter((u) => u.id !== id);
  return c;
}

/**
 * The clones of a carry come back beside `at` and join the ones already here (nobody here moves). Their souls reach the base;
 * a run nobody came back from brings none (they were lost with it). The pack and resources are the carry's (this map waited).
 */
export function rejoin(p: RoamParty, c: Carry, at: Cell): void {
  const s = p.s, free = (x: Cell) => walkable(tileAt(s.map, x)) && !p.units.some((u) => alive(p, u) && same(entOf(p, u.id)!.pos, x));
  const spots: Cell[] = [];
  for (let r = 0; r < 4; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = { x: at.x + dx, y: at.y + dy }; if (free(x) && !spots.some((o) => same(o, x))) spots.push(x); }
  c.clones.forEach((k, i) => {
    const pos = spots[i] ?? at, e = k.unit.id === 'hero' ? s.hero : spawnFoe(s, 'minion', pos, false);
    e.id = k.unit.id; e.pos = { ...pos }; e.hp = k.hp; e.maxHp = k.maxHp; e.alive = true; e.awake = false;
    const unit = structuredClone(k.unit);
    shiftUnitTimes(unit, p.time - c.time);
    p.units = [{ ...unit, shield: 0, order: null, queued: undefined } as Unit, ...p.units.filter((u) => u.id !== unit.id)];
  });
  p.pack = structuredClone(c.pack); p.nextItem = c.nextItem;
  p.ore = c.ore; p.crystal = c.crystal; p.bio = c.bio; p.nextClone = Math.max(p.nextClone, c.nextClone);
  p.foundHeroes = [...new Set([...p.foundHeroes, ...c.foundHeroes])];
  if (c.clones.length) p.carried = [...p.carried, ...structuredClone(c.carried)];
  p.combat = false; p.waiting = false; p.manual = undefined; p.over = false; p.rewakeAt = undefined;
  if (!entOf(p, p.leader ?? '')?.alive) p.leader = living(p)[0]?.id ?? p.leader;
  look(p);
}

export const anyAlive = (p: RoamParty): boolean => p.units.some((u) => u.side === 'hero' && alive(p, u));

// Derive deadline keys from Unit; runtime enumeration automatically includes new numeric deadlines.
type TimeKey = { [K in keyof Unit]-?: NonNullable<Unit[K]> extends number
  ? K extends `${string}Until` | `${string}Ready` | `${string}At` ? K : never : never }[keyof Unit];
export function shiftUnitTimes(unit: Unit, shift: number): void {
  for (const key of Object.keys(unit) as (keyof Unit)[]) {
    if (typeof unit[key] === 'number' && /(?:Until|Ready|At)$/.test(key)) {
      const timeKey = key as TimeKey;
      unit[timeKey] = (unit[timeKey] ?? 0) + shift;
    }
  }
  unit.ready = unit.ready.map(t => t + shift) as Unit['ready'];
  for (const key of Object.keys(unit.trig)) unit.trig[key]! += shift;
  for (const status of Object.values(unit.status)) if (status) {
    status.until += shift;
    if (status.next !== undefined) status.next += shift;
  }
  for (const s of unit.souls ?? []) s.ultReady += shift;
}
