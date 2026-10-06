import { numbers, worn } from '../delve/gear';
import { alive, type Unit } from '../party/partyCore';
import { LINE } from '../party/classKit';
import { levelOf } from '../party/partyLevel';
import type { RoamParty } from '../roam/roam';

/** 10 base + 5 per level + average weapon damage + 20×armor/block + 2 per trait rank + 12 promoted.
 * A shell is 10; an equipped promoted level-8 clone with five ranks is about 75.
 */
export function unitPower(p: RoamParty, u: Unit): number {
  if (u.side !== 'hero' || !alive(p, u)) return 0;
  const gear = worn(u).reduce((sum, it) => { const n = numbers(it); return sum + (n.min + n.max) / 2 + 20 * (n.armor + n.block); }, 0);
  const traits = Object.values(u.traits ?? {}).reduce<number>((sum, rank) => sum + (rank ?? 0), 0);
  return Math.round(10 + 5 * (levelOf(u) - 1) + gear + 2 * traits + (u.cls && (LINE[u.cls] || u.cls === 'veteran') ? 12 : 0));
}
export const partyPower = (p: RoamParty): number => p.units.reduce((sum, u) => sum + unitPower(p, u), 0);
/** Documented recommendation curve, not bot-calibrated: quadratic through floors 1=15, 5=60, 10=140. */
export const floorPower = (floor: number): number => { const f = Math.max(1, Math.floor(floor)); return Math.round((19 * f * f + 291 * f + 230) / 36); };
