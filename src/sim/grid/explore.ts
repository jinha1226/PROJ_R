import { stepBlocked, walkBlocked } from './actions';
import { DIRS, add, canStep, idx, inBounds, type Cell, type GridState } from './types';

/** Nearest known frontier, in stable walking order; a known trap is crossed (disarmed) only when there is no way round it. */
export function exploreTarget(s: GridState): Cell | null {
  return frontier(s, (c) => walkBlocked(s, c)) ?? frontier(s, (c) => stepBlocked(s, c));
}

function frontier(s: GridState, blocked: (c: Cell) => boolean): Cell | null {
  const queue = [s.hero.pos];
  const visited = new Set([idx(s.map, s.hero.pos)]);
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!;
    if (s.seen[idx(s.map, c)] && !blocked(c) && DIRS.some((d) => {
      const n = add(c, d);
      return inBounds(s.map, n) && !s.seen[idx(s.map, n)];
    })) return { ...c };
    for (const d of DIRS) {
      const n = add(c, d), key = idx(s.map, n);
      if (visited.has(key) || !canStep(s.map, c, d) || !s.seen[key] || blocked(n)) continue;
      visited.add(key);
      queue.push(n);
    }
  }
  return null;
}
