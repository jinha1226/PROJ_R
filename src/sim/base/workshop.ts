import { CATALOG } from '../delve/catalog';
import { numbers, sacrificeRate } from '../delve/gear';
import type { GEvent } from '../grid/types';
import { soulsOf } from '../party/body';
import { alive, type Unit } from '../party/partyCore';
import { refitHp } from '../party/partyLevel';
import type { Tag } from '../party/buildTypes';
import type { TriggerDef } from '../party/triggers';
import { clones, slotsOf, type RoamParty } from '../roam/roam';
import { sfModule, type SfPart } from './sfModules';

/** the gun's and the suit's effect slots */
export const SF_SLOTS: Record<SfPart, number> = { gun: 2, suit: 1 };
type Grown = { power: number; bonus: Partial<Record<'min' | 'max' | 'armor' | 'block', number>> };
/** The base's workshop: blueprints opened, modules built and fitted, what dismantling has added to the gun and suit, soul slots bought. */
export interface SfState { blueprints: string[]; owned: string[]; fitted: { gun: (string | null)[]; suit: (string | null)[] }; gun: Grown; suit: Grown; slotsBought: number }

export function sfOf(p: RoamParty): SfState {
  return (p.sf ??= { blueprints: [], owned: [], fitted: { gun: [], suit: [] }, gun: { power: 0, bonus: {} }, suit: { power: 0, bonus: {} }, slotsBought: 0 });
}
const empty = (u: Unit) => u.side === 'hero' && !u.summoner && u.cls === 'shell' && !soulsOf(u).length;

/** Puts the workshop's state on an empty body: its pistol and suit as grown by dismantling, the modules fitted. */
export function applySf(p: RoamParty, u: Unit): void {
  if (!empty(u) || !u.gear) return;
  const sf = sfOf(p);
  if (u.gear.weapon?.def === 'pistol') { u.gear.weapon.power = sf.gun.power; u.gear.weapon.bonus = { ...sf.gun.bonus }; }
  if (u.gear.armor?.def === 'agentSuit') { u.gear.armor.power = sf.suit.power; u.gear.armor.bonus = { ...sf.suit.bonus }; }
  u.sfMods = [...sf.fitted.gun, ...sf.fitted.suit].filter((id): id is string => !!id);
  refitHp(p, u);
}
const applyAll = (p: RoamParty) => { for (const u of clones(p)) if (alive(p, u)) applySf(p, u); };

/**
 * A fantasy weapon or armour from the pack is taken apart: its effect's blueprint opens and its numbers go into the gun or
 * the suit at the sacrifice rate (as a sacrifice into the same slot would). Accessories stay as they are.
 */
export function dismantle(p: RoamParty, itemId: string): GEvent[] {
  const i = p.pack.findIndex((it) => it.id === itemId), it = p.pack[i];
  if (!it || !('def' in it)) return [];
  const d = CATALOG[it.def];
  if (!d || d.slot === 'accessory' || d.family === 'gun' || d.id === 'agentSuit') return [];
  const sf = sfOf(p), part: SfPart = d.slot === 'weapon' ? 'gun' : 'suit', grown = sf[part];
  const rate = sacrificeRate(p), n = numbers(it), base = numbers({ id: 'kit', def: part === 'gun' ? 'pistol' : 'agentSuit', power: 0 }), gain = (1 + it.power) * rate;
  for (const k of ['min', 'max', 'armor', 'block'] as const) grown.bonus[k] = (grown.bonus[k] ?? 0) + n[k] * rate - base[k] * gain;
  grown.power += gain;
  const bp = `sf-${d.id}`;
  if (sfModule(bp) && !sf.blueprints.includes(bp)) sf.blueprints.push(bp);
  p.pack.splice(i, 1);
  applyAll(p);
  return [{ t: p.time, type: 'buff', text: '분해', amount: Math.round(gain * 100) }];
}

const afford = (p: RoamParty, c: { ore?: number; crystal?: number; bio?: number }) => p.ore >= (c.ore ?? 0) && p.crystal >= (c.crystal ?? 0) && p.bio >= (c.bio ?? 0);
export const canCraft = (p: RoamParty, id: string): boolean => { const m = sfModule(id), sf = sfOf(p); return !!m && sf.blueprints.includes(id) && !sf.owned.includes(id) && afford(p, m.cost); };
export function craft(p: RoamParty, id: string): boolean {
  if (!canCraft(p, id)) return false;
  const c = sfModule(id)!.cost;
  p.ore -= c.ore ?? 0; p.crystal -= c.crystal ?? 0; p.bio -= c.bio ?? 0;
  sfOf(p).owned.push(id);
  return true;
}
/** Fits an owned module into a gun or suit slot (null empties it); a module sits in one slot at a time. */
export function fit(p: RoamParty, part: SfPart, index: number, id: string | null): boolean {
  const sf = sfOf(p), slots = sf.fitted[part];
  if (index < 0 || index >= SF_SLOTS[part]) return false;
  if (id !== null) {
    const m = sfModule(id);
    if (!m || m.part !== part || !sf.owned.includes(id) || slots.includes(id)) return false;
  }
  while (slots.length < SF_SLOTS[part]) slots.push(null);
  slots[index] = id;
  sf.fitted[part] = slots.slice(0, SF_SLOTS[part]);
  applyAll(p);
  return true;
}

/** soul slots cost more each time: 10, 20, 40… crystal */
export const soulSlotCost = (p: RoamParty): number => 10 * 2 ** sfOf(p).slotsBought;
export function buySoulSlot(p: RoamParty): boolean {
  const cost = soulSlotCost(p);
  if (p.crystal < cost) return false;
  p.crystal -= cost; p.soulSlots = slotsOf(p) + 1; sfOf(p).slotsBought++;
  return true;
}

/** the triggers and tags of the modules an empty body carries (none once a soul is in it) */
export const sfTriggers = (u: Unit): TriggerDef[] => (soulsOf(u).length ? [] : (u.sfMods ?? []).flatMap((id) => sfModule(id)?.triggers ?? []));
export const sfTags = (u: Unit): Tag[] => (soulsOf(u).length ? [] : (u.sfMods ?? []).flatMap((id) => sfModule(id)?.tags ?? []));
