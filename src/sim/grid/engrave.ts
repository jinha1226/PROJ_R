import { ENGRAVE_IDS, ENGRAVES, type EngraveId } from './engraveCore';
import { activeWeapon } from './gear';
import { WEAPONS, type RuneStone, type Weapon } from './items';
import type { GridState } from './types';

/** Engravings a weapon holds (the prototype gives every weapon two; upgrades add more later). */
export const ENGRAVE_SLOTS = 2;
export const RUNE_CHANCE = 0.35;
const MAX_LVL = 3;
const OFFER_SIZE = 3;
/** an engraving that suits the weapon in hand is this many times likelier to be offered */
const FIT_WEIGHT = 4;

export function runeStone(id: EngraveId): RuneStone {
  return { kind: 'rune', id, name: `룬석: ${ENGRAVES[id].name}` };
}

/** Puts an engraving on a weapon: the same one again goes up a level, a full weapon loses its oldest. */
export function inscribe(w: Weapon, id: EngraveId): void {
  const list = (w.engraves ??= []);
  const had = list.find((e) => e.id === id);
  if (had) { had.lvl = Math.min(MAX_LVL, had.lvl + 1) as 1 | 2 | 3; return; }
  if (list.length >= ENGRAVE_SLOTS) list.shift();
  list.push({ id, lvl: 1 });
}

/** A rune can go on a weapon that does not already carry that engraving (levels do nothing yet). */
export const canInscribe = (w: Weapon, id: EngraveId): boolean => !w.engraves?.some((e) => e.id === id);

/** The engraving a new one would push off a full weapon (null if there is room or it is already there). */
export function wouldErase(w: Weapon | null, id: EngraveId): EngraveId | null {
  const list = w?.engraves ?? [];
  return list.length >= ENGRAVE_SLOTS && !list.some((e) => e.id === id) ? list[0]!.id : null;
}

/** What kind of engraving suits a weapon. */
export function fitOf(w: Weapon | null): 'melee' | 'ranged' | 'magic' {
  if (!w || WEAPONS[w.group].melee) return 'melee';
  return w.group === 'staff' ? 'magic' : 'ranged';
}

/** Three different engravings for a level-up, weighted toward the weapon in hand (and not ones it already has). */
export function offerFor(s: GridState): EngraveId[] {
  const w = activeWeapon(s.hero.gear);
  const fit = fitOf(w);
  const pool = ENGRAVE_IDS.filter((id) => !w?.engraves?.some((e) => e.id === id));
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
