import { ENGRAVE_IDS, ENGRAVES, SUIT_SLOTS, type EngraveId } from './engraveCore';
import { activeWeapon } from './gear';
import { WEAPONS, type Weapon } from './items';
import type { GridState } from './types';

const OFFER_SIZE = 3;
const FIT_WEIGHT = 4;

/** Append to a free suit slot, or explicitly replace one when full; never duplicate. */
export function putOnSuit(s: GridState, id: EngraveId, slot?: number): boolean {
  const suit = s.hero.suit;
  if (suit.includes(id)) return false;
  if (suit.length < SUIT_SLOTS) { suit.push(id); return true; }
  if (slot === undefined || !Number.isInteger(slot) || slot < 0 || slot >= SUIT_SLOTS) return false;
  suit[slot] = id;
  return true;
}

/** What kind of engraving suits a weapon. */
export function fitOf(w: Weapon | null): 'melee' | 'ranged' | 'magic' {
  if (!w || WEAPONS[w.group].melee) return 'melee';
  return w.group === 'staff' ? 'magic' : 'ranged';
}

/** Three different engravings for a level-up, weighted toward the weapon in hand (excluding those on the suit). */
export function offerFor(s: GridState): EngraveId[] {
  const w = activeWeapon(s.hero.gear);
  const fit = fitOf(w);
  const pool = ENGRAVE_IDS.filter((id) => !s.hero.suit.includes(id));
  const weight = (id: EngraveId) => (ENGRAVES[id].fits === fit || ENGRAVES[id].fits === 'any' ? FIT_WEIGHT : 1);
  const out: EngraveId[] = [];
  while (out.length < OFFER_SIZE && pool.length) {
    let r = s.rng.next() * pool.reduce((sum, id) => sum + weight(id), 0);
    let i = 0;
    while (i < pool.length - 1 && (r -= weight(pool[i]!)) >= 0) i++;
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}
