import { refreshParty } from './party';
import type { WorldState } from './types';
import { dropAt } from './interact';
import { heroUnit } from './worldState';

/** Re-derives stats after gear or pack weight changed; pack overflow (a lost member's bag) lands at the leader's feet. */
export function refreshHero(w: WorldState): void {
  const { dropped } = refreshParty(w);
  if (dropped.length) dropAt(w, heroUnit(w).pos, dropped, true);
}
