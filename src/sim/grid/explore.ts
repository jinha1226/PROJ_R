import { walkBlocked } from './actions';
import { DIRS, add, canStep, idx, inBounds, type Cell, type GridState } from './types';

/** Nearest known frontier, in stable walking order; never route through hazards. */
export function exploreTarget(s: GridState): Cell | null {
  const queue = [s.hero.pos];
  const visited = new Set([idx(s.map, s.hero.pos)]);
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!;
    if (s.seen[idx(s.map, c)] && !walkBlocked(s, c) && DIRS.some((d) => {
      const n = add(c, d);
      return inBounds(s.map, n) && !s.seen[idx(s.map, n)];
    })) return { ...c };
    for (const d of DIRS) {
      const n = add(c, d), key = idx(s.map, n);
      if (visited.has(key) || !canStep(s.map, c, d) || !s.seen[key] || walkBlocked(s, n)) continue;
      visited.add(key);
      queue.push(n);
    }
  }
  return null;
}
