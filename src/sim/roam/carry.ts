import type { Item } from '../delve/items';
import { spawnFoe } from '../grid/foes';
import { alive, entOf, type Unit } from '../party/partyCore';
import type { CarriedSoul, HeroSoulId } from '../delve/heroSouls';
import { living, look, type RoamParty } from './roam';

/** What goes up and down the shaft with the party: the living clones as they are, the souls carried, the bio-matter, the next clone's number. */
export interface Carry { time: number; pack: Item[]; nextItem: number; clones: { unit: Unit; hp: number; maxHp: number }[]; carried: CarriedSoul[]; ore: number; crystal: number; foundHeroes: HeroSoulId[]; bio: number; nextClone: number }

export function takeParty(p: RoamParty): Carry {
  return { time: p.time, pack: structuredClone(p.pack), nextItem: p.nextItem, clones: living(p).map((u) => ({ unit: structuredClone(u), hp: entOf(p, u.id)!.hp, maxHp: entOf(p, u.id)!.maxHp })), ore: p.ore, crystal: p.crystal, foundHeroes: [...p.foundHeroes], carried: structuredClone(p.carried), bio: p.bio, nextClone: p.nextClone };
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
    unit.ultReady = p.time+Math.max(0,unit.ultReady-c.time);
    for(const key of Object.keys(unit.trig)) unit.trig[key]! += shift;
    for(const status of Object.values(unit.status)) if(status) { status.until += shift; if(status.next!==undefined) status.next += shift; }
    return { ...unit, order: null, queued: undefined, nextAt: p.time, ready: [p.time, p.time] } as Unit;
  });
  p.units = [...heroes, ...p.units];
  p.pack = structuredClone(c.pack); p.nextItem = c.nextItem;
  p.ore = c.ore; p.crystal = c.crystal; p.foundHeroes = [...c.foundHeroes];
  p.carried = structuredClone(c.carried); p.bio = c.bio; p.nextClone = c.nextClone;
  p.combat = false; p.waiting = false; p.manual = undefined; p.over = false; p.rewakeAt = undefined;
  p.leader = c.clones[0]?.unit.id ?? 'hero';
  look(p);
}

export const anyAlive = (p: RoamParty): boolean => p.units.some((u) => u.side === 'hero' && alive(p, u));
