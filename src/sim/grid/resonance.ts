import { ENGRAVES } from './engraveCore';
import type { Family } from './engraveDefs';
import type { GridState } from './types';

/** Recompute from the suit, never discovery history or the active weapon. */
export function resonance(s: GridState): Record<Family, boolean> {
  const counts: Record<Family, number> = { melee: 0, ranged: 0, fusion: 0, element: 0 };
  for (const id of new Set(s.hero.suit)) {
    const def = ENGRAVES[id];
    if (def) counts[def.family]++;
  }
  return { melee: counts.melee >= 3, ranged: counts.ranged >= 3, fusion: counts.fusion >= 3, element: counts.element >= 3 };
}

export const pistolCost = (s: GridState, base: number): number => Math.max(1, base - Number(resonance(s).ranged));
