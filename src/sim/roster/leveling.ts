import { MAX_LEVEL, type Mercenary } from './types';

export const xpToNext = (level: number): number => 40 + 30 * (level - 1);

/** Adds xp; each level gained queues a level-up choice. Xp is dropped at max level. */
export function addXp(m: Mercenary, xp: number): Mercenary {
  let { level, pendingLevelUps } = m;
  let rest = m.xp + Math.max(0, Math.round(xp));
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
    pendingLevelUps++;
  }
  return { ...m, level, pendingLevelUps, xp: level >= MAX_LEVEL ? 0 : rest };
}
