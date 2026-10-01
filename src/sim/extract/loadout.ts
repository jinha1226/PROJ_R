import { xitem, type GearSlot } from '../../data/extract';
import type { WeaponType } from '../../data/types';
import { mergeAll, putInto, stackValue, stackWeight, type Stack } from './inventory';

export type { Stack } from './inventory';

/** What the hero wears and carries on a sortie. The pouch survives death. */
export interface Loadout {
  equipped: Partial<Record<GearSlot, string>>;
  bag: Stack[];
  quick: (Stack | null)[];
  pouch: Stack | null;
}

const POCKET_SLOTS = 6;
const POCKET_CARRY = 15;
const FREE_LOAD = 0.6;
const MAX_SLOW = 0.3;

export const emptyLoadout = (): Loadout => ({ equipped: {}, bag: [], quick: [null], pouch: null });

export const bagSlots = (l: Loadout): number => (l.equipped.bag ? xitem(l.equipped.bag).bag!.slots : POCKET_SLOTS);
export const carryLimit = (l: Loadout): number => (l.equipped.bag ? xitem(l.equipped.bag).bag!.carry : POCKET_CARRY);
export const quickSlots = (l: Loadout): number => (l.equipped.belt ? xitem(l.equipped.belt).belt!.quickSlots : 1);

const worn = (l: Loadout): string[] => Object.values(l.equipped).filter((id): id is string => !!id);

export function totalWeight(l: Loadout): number {
  const w = worn(l).reduce((a, id) => a + xitem(id).weight, 0)
    + l.bag.reduce((a, s) => a + stackWeight(s), 0) + l.quick.reduce((a, s) => a + stackWeight(s), 0) + stackWeight(l.pouch);
  return Math.round(w * 100) / 100;
}

/** 1.0 up to 60% of the carry limit, then linearly down to 0.7 at 100% (and below past it). */
export function speedMult(l: Loadout): number {
  const ratio = totalWeight(l) / carryLimit(l);
  if (ratio <= FREE_LOAD) return 1;
  return Math.max(1 - MAX_SLOW * 1.5, 1 - (MAX_SLOW * (ratio - FREE_LOAD)) / (1 - FREE_LOAD));
}

/** Everything lost on death: worn gear, bag, quick slots (not the pouch). */
export function carriedValue(l: Loadout): number {
  return worn(l).reduce((a, id) => a + xitem(id).value, 0) + l.bag.reduce((a, s) => a + stackValue(s), 0) + l.quick.reduce((a, s) => a + stackValue(s), 0);
}

/** Adds to the bag: stacks first, new slots while free, never past the carry limit. */
export function addItem(l: Loadout, id: string, n = 1): { loadout: Loadout; added: number } {
  const w = xitem(id).weight;
  const free = carryLimit(l) - totalWeight(l);
  const r = putInto(l.bag, id, n, bagSlots(l), (k) => k * w <= free + 1e-9);
  return { loadout: { ...l, bag: r.list }, added: r.added };
}

export function removeAt(l: Loadout, where: 'bag' | 'quick' | 'pouch', index: number, n?: number): { loadout: Loadout; taken: Stack } {
  const from = where === 'bag' ? l.bag[index] : where === 'quick' ? l.quick[index] : l.pouch;
  if (!from) throw new Error(`nothing at ${where}[${index}]`);
  const k = Math.min(from.n, n ?? from.n);
  const rest = from.n - k > 0 ? { id: from.id, n: from.n - k } : null;
  const taken = { id: from.id, n: k };
  if (where === 'bag') return { loadout: { ...l, bag: rest ? l.bag.map((s, i) => (i === index ? rest : s)) : l.bag.filter((_, i) => i !== index) }, taken };
  if (where === 'quick') return { loadout: { ...l, quick: l.quick.map((s, i) => (i === index ? rest : s)) }, taken };
  return { loadout: { ...l, pouch: rest }, taken };
}

/** After the bag or belt changed: whatever no longer fits goes to the bag, then to the ground. */
function settleCapacity(l: Loadout): { loadout: Loadout; dropped: Stack[] } {
  let dropped: Stack[] = [];
  const qn = quickSlots(l);
  const spill = l.quick.slice(qn).filter((s): s is Stack => !!s);
  let next: Loadout = { ...l, quick: Array.from({ length: qn }, (_, i) => l.quick[i] ?? null) };
  const slots = bagSlots(next);
  if (next.bag.length > slots) {
    dropped = mergeAll(dropped, next.bag.slice(slots));
    next = { ...next, bag: next.bag.slice(0, slots) };
  }
  for (const s of spill) {
    const r = putInto(next.bag, s.id, s.n, slots, () => true);
    next = { ...next, bag: r.list };
    if (r.added < s.n) dropped = mergeAll(dropped, [{ id: s.id, n: s.n - r.added }]);
  }
  return { loadout: next, dropped };
}

/** Wears a bag item (2 s in the field — the sim times it). The old piece returns to the bag or the ground. */
export function equipFromBag(l: Loadout, index: number, classWeapon: WeaponType): { loadout: Loadout; dropped: Stack[] } {
  const s = l.bag[index];
  if (!s) throw new Error(`nothing at bag[${index}]`);
  const def = xitem(s.id);
  if (def.kind !== 'gear' || !def.slot) throw new Error(`${s.id} is not gear`);
  if (def.slot === 'weapon' && def.weaponType !== classWeapon) throw new Error(`${s.id} is not a ${classWeapon} weapon`);
  const old = l.equipped[def.slot];
  let next: Loadout = { ...removeAt(l, 'bag', index, 1).loadout, equipped: { ...l.equipped, [def.slot]: s.id } };
  let dropped: Stack[] = [];
  if (old) {
    const r = putInto(next.bag, old, 1, Infinity, () => true);
    next = { ...next, bag: r.list };
  }
  const settled = settleCapacity(next);
  dropped = mergeAll(dropped, settled.dropped);
  return { loadout: settled.loadout, dropped };
}

export function unequipToBag(l: Loadout, slot: GearSlot): { loadout: Loadout; dropped: Stack[] } {
  const id = l.equipped[slot];
  if (!id) throw new Error(`nothing worn on ${slot}`);
  const equipped = { ...l.equipped };
  delete equipped[slot];
  const r = putInto(l.bag, id, 1, Infinity, () => true);
  return settleCapacity({ ...l, equipped, bag: r.list });
}

/** Moves a consumable stack from the bag into a quick slot (swapping what was there). */
export function moveToQuick(l: Loadout, bagIndex: number, quickIndex: number): Loadout {
  const s = l.bag[bagIndex];
  if (!s || xitem(s.id).kind !== 'consumable') throw new Error('only consumables go in quick slots');
  if (quickIndex >= quickSlots(l)) throw new Error('no such quick slot');
  const prev = l.quick[quickIndex];
  const bag = l.bag.filter((_, i) => i !== bagIndex);
  if (prev) bag.splice(bagIndex, 0, prev);
  return { ...l, bag, quick: l.quick.map((q, i) => (i === quickIndex ? s : q)) };
}

/** On death everything is lost except the safe pouch. */
export const loseOnDeath = (l: Loadout): Loadout => ({ equipped: {}, bag: [], quick: [null], pouch: l.pouch });
