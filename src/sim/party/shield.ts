import type { Unit } from './partyCore';
import { ampBase, rank } from './traitTypes';
import { tagsOf } from './classKit';
export const SHIELD_CAP = 60;
/** Adds a shield (up to the cap); a giver with the sacred wall card makes it larger by its shield and healing tags. */
export function addShield(u: Unit, amount: number, src?: Unit): void {
  const wall = src && rank(src, 'sacredWall') ? ampBase(src, 'sacredWall', 1.15) ** (tagsOf(src).방패 ?? 0) : 1;
  u.shield = Math.min(SHIELD_CAP, Math.max(0, u.shield + Math.round(amount * wall)));
}
