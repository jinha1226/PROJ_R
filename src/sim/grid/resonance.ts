import { ENGRAVES } from './engraveCore';
import type { Family } from './engraveDefs';
import type { GridState } from './types';

export const FAMILIES: Family[] = ['melee', 'ranged', 'fusion', 'element'];
export const FAMILY_NAMES: Record<Family, string> = { melee: '근접', ranged: '원거리', fusion: '퓨전', element: '원소' };

/** Recompute from the suit, never discovery history or the active weapon. */
export function familyCounts(s: GridState): Record<Family, number> {
  const counts: Record<Family, number> = { melee: 0, ranged: 0, fusion: 0, element: 0 };
  for (const id of new Set(s.hero.suit)) {
    const def = ENGRAVES[id];
    if (def) counts[def.family]++;
  }
  return counts;
}

export function resonance(s: GridState): Record<Family, boolean> {
  const counts = familyCounts(s);
  return { melee: counts.melee >= 3, ranged: counts.ranged >= 3, fusion: counts.fusion >= 3, element: counts.element >= 3 };
}

export const pistolCost = (_s: GridState, base: number): number => base;
