import { foeTurn } from './ai';
import type { GridState } from './types';

/** Lets every foe whose turn comes before the hero's next one act, earliest first (ties: list order); the hero wins ties. */
export function runUntilHero(s: GridState): void {
  for (let guard = 0; guard < 10000 && s.hero.alive; guard++) {
    let next: (typeof s.foes)[number] | undefined;
    for (const f of s.foes) if (f.alive && f.nextAt < s.hero.nextAt && (!next || f.nextAt < next.nextAt)) next = f;
    if (!next) return;
    next.nextAt += foeTurn(s, next);
  }
}
