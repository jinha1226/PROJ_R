import type { Item } from '../delve/items';
import { spawnFoe } from '../grid/foes';
import { alive, entOf, type Unit } from '../party/partyCore';
import type { BaseClass } from '../party/partyDefs';
import { living, look, type RoamParty } from './roam';

/** What goes up and down the shaft with the party: the living clones as they are, the souls carried, the bio-matter, the next clone's number. */
export interface Carry { pack: Item[]; potions: number; nextItem: number; clones: { unit: Unit; hp: number; maxHp: number }[]; carried: BaseClass[]; bio: number; nextClone: number }

export function takeParty(p: RoamParty): Carry {
  return { pack: structuredClone(p.pack), potions: p.potions, nextItem: p.nextItem, clones: living(p).map((u) => ({ unit: structuredClone(u), hp: entOf(p, u.id)!.hp, maxHp: entOf(p, u.id)!.maxHp })), carried: [...p.carried], bio: p.bio, nextClone: p.nextClone };
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
    return { ...structuredClone(k.unit), order: null, queued: undefined, nextAt: p.time, ready: [p.time, p.time] } as Unit;
  });
  p.units = [...heroes, ...p.units];
  p.pack = structuredClone(c.pack); p.potions = c.potions; p.nextItem = c.nextItem;
  p.carried = [...c.carried]; p.bio = c.bio; p.nextClone = c.nextClone;
  p.combat = false; p.waiting = false; p.manual = undefined; p.over = false; p.rewakeAt = undefined;
  p.leader = c.clones[0]?.unit.id ?? 'hero';
  look(p);
}

export const anyAlive = (p: RoamParty): boolean => p.units.some((u) => u.side === 'hero' && alive(p, u));
