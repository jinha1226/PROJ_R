import { STARTER_KIT, xitem, type GearSlot } from '../../data/extract';
import { WEAPON_TYPE_OF_CLASS } from '../../data/items';
import { createProtagonist } from '../roster/generate';
import { addXp } from '../roster/leveling';
import { putInto, stackValue, type Stack } from './inventory';
import { addItem, emptyLoadout, loseOnDeath, quickSlots, removeAt, type Loadout } from './loadout';
import { bank, STASH_SLOTS } from './merchant';
import type { XProfile } from './profileTypes';

export * from './profileTypes';
export { sell, buy, MERCHANT_STOCK, STASH_SLOTS } from './merchant';

const START_GOLD = 50;

export function newProfile(seed: number): XProfile {
  const hero = createProtagonist(seed);
  const loadout: Loadout = { ...emptyLoadout(), equipped: { weapon: STARTER_KIT.weapon[WEAPON_TYPE_OF_CLASS[hero.classId]], chest: STARTER_KIT.chest } };
  return { version: 1, seed, hero, gold: START_GOLD, stash: [], loadout, sorties: 0, extracted: 0, bestHaul: 0 };
}

/** The free worn kit, for empty weapon/chest slots only. */
export function claimStarterKit(p: XProfile): XProfile {
  const eq = { ...p.loadout.equipped };
  eq.weapon ??= STARTER_KIT.weapon[WEAPON_TYPE_OF_CLASS[p.hero.classId]];
  eq.chest ??= STARTER_KIT.chest;
  return { ...p, loadout: { ...p.loadout, equipped: eq } };
}

/** A promotion can change the weapon family: an unusable weapon moves to the stash and the class starter weapon is worn. */
export function reconcileWeapon(p: XProfile): XProfile {
  const want = WEAPON_TYPE_OF_CLASS[p.hero.classId];
  const w = p.loadout.equipped.weapon;
  if (w && xitem(w).weaponType === want) return p;
  const next = { ...p, loadout: { ...p.loadout, equipped: { ...p.loadout.equipped, weapon: STARTER_KIT.weapon[want] } } };
  return w && xitem(w).tier > 0 ? bank(next, [{ id: w, n: 1 }]) : next;
}

export function canSortie(p: XProfile): { ok: boolean; reason?: string } {
  return p.stash.length > STASH_SLOTS ? { ok: false, reason: 'stashFull' } : { ok: true };
}

const worn = (l: Loadout): Stack[] => Object.values(l.equipped).filter((id): id is string => !!id).map((id) => ({ id, n: 1 }));

/** Applies a sortie's end: extraction banks the bag and keeps the rest; going down keeps only the pouch. */
export function settleSortie(p: XProfile, end: { outcome: 'extracted' | 'downed'; loadout: Loadout; xp: number }): { profile: XProfile; lost: Stack[]; gained: Stack[] } {
  const hero = addXp(p.hero, end.xp);
  const base = { ...p, hero, sorties: p.sorties + 1 };
  if (end.outcome === 'downed') {
    const lost = [...worn(end.loadout), ...end.loadout.bag, ...end.loadout.quick.filter((q): q is Stack => !!q)];
    return { profile: { ...base, loadout: loseOnDeath(end.loadout) }, lost, gained: [] };
  }
  const gained = end.loadout.bag;
  const haul = gained.reduce((a, s) => a + stackValue(s), 0);
  const profile = bank({ ...base, extracted: p.extracted + 1, bestHaul: Math.max(p.bestHaul, haul), loadout: { ...end.loadout, bag: [] } }, gained);
  return { profile, lost: [], gained };
}

/** Takes a stash stack into the loadout: gear is worn (the old piece returns), consumables go to quick slots, the rest to the bag. */
export function stashToLoadout(p: XProfile, stashIndex: number): XProfile {
  const s = p.stash[stashIndex];
  if (!s) throw new Error(`nothing at stash[${stashIndex}]`);
  const def = xitem(s.id);
  const rest = p.stash.filter((_, i) => i !== stashIndex);
  const l = p.loadout;
  if (def.kind === 'gear' && def.slot) {
    if (def.slot === 'weapon' && def.weaponType !== WEAPON_TYPE_OF_CLASS[p.hero.classId]) throw new Error('wrong weapon type');
    const old = l.equipped[def.slot];
    const stash = s.n > 1 ? [...rest.slice(0, stashIndex), { id: s.id, n: s.n - 1 }, ...rest.slice(stashIndex)] : rest;
    const next = { ...p, stash, loadout: { ...l, equipped: { ...l.equipped, [def.slot]: s.id } } };
    return old ? bank(next, [{ id: old, n: 1 }]) : next;
  }
  if (def.kind === 'consumable') {
    const qn = quickSlots(l);
    const quick = Array.from({ length: qn }, (_, i) => l.quick[i] ?? null);
    const at = quick.findIndex((q) => q?.id === s.id && q.n < def.stack);
    const free = quick.findIndex((q) => !q);
    if (at >= 0 || free >= 0) {
      const i = at >= 0 ? at : free;
      const have = quick[i]?.n ?? 0;
      const k = Math.min(def.stack - have, s.n);
      quick[i] = { id: s.id, n: have + k };
      const stash = s.n - k > 0 ? [...rest.slice(0, stashIndex), { id: s.id, n: s.n - k }, ...rest.slice(stashIndex)] : rest;
      return { ...p, stash, loadout: { ...l, quick } };
    }
  }
  const r = addItem(l, s.id, s.n);
  if (!r.added) throw new Error('no room in the bag');
  const stash = s.n - r.added > 0 ? [...rest.slice(0, stashIndex), { id: s.id, n: s.n - r.added }, ...rest.slice(stashIndex)] : rest;
  return { ...p, stash, loadout: r.loadout };
}

/** Puts something from the loadout back into the stash (refused when the stash has no room). */
export function loadoutToStash(p: XProfile, where: 'bag' | 'quick' | 'pouch' | GearSlot, index: number): XProfile {
  let loadout = p.loadout;
  let taken: Stack;
  if (where === 'bag' || where === 'quick' || where === 'pouch') ({ loadout, taken } = removeAt(loadout, where, index));
  else {
    const id = loadout.equipped[where];
    if (!id) throw new Error(`nothing worn on ${where}`);
    const equipped = { ...loadout.equipped };
    delete equipped[where];
    loadout = { ...loadout, equipped };
    taken = { id, n: 1 };
  }
  const r = putInto(p.stash, taken.id, taken.n, STASH_SLOTS, () => true);
  if (r.added < taken.n) throw new Error('stash is full');
  return { ...p, stash: r.list, loadout };
}
