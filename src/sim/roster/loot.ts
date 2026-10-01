import type { Rng } from '../../core/rng';
import { ITEMS } from '../../data/items';

/** One item at a tier around stage/3 (falls back to lower tiers when none exist). */
export function rollItem(rng: Rng, stage: number): string {
  let tier = Math.max(0, Math.min(4, Math.floor(stage / 3) + rng.int(-1, 1)));
  const all = Object.values(ITEMS);
  for (; tier >= 0; tier--) {
    const pool = all.filter((i) => i.tier === tier && i.tier > 0);
    if (pool.length) return rng.pick(pool).id;
  }
  return rng.pick(all.filter((i) => i.tier === 1)).id;
}
