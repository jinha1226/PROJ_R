import type { Unit } from './partyCore';
import { rank } from './traitTypes';
import { tagsOf } from './classKit';
export const SHIELD_CAP = 60;
/** Adds a shield (up to the cap); a giver with the sacred wall card makes it larger by its shield and healing tags. */
export function addShield(u: Unit, amount: number, src?: Unit): void {
  const wall = src && rank(src, 'sacredWall') ? 1 + 0.15 * ((tagsOf(src).방패 ?? 0) + (tagsOf(src).치유 ?? 0)) : 1;
  u.shield = Math.min(SHIELD_CAP, Math.max(0, u.shield + Math.round(amount * wall)));
}
