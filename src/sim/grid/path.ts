import { DIRS, add, canStep, idx, same, type Cell, type GridMap } from './types';

/** Shortest walk (8-way; a diagonal may round a corner, not slip between two shut cells) from `from` to `to`; excludes `from`, includes `to`. Blocked cells other than `to` are avoided. */
export function findPath(m: GridMap, from: Cell, to: Cell, blocked?: (c: Cell) => boolean, maxSteps = 4000): Cell[] | null {
  if (same(from, to)) return [];
  const prev = new Map<number, number>();
  const start = idx(m, from);
  prev.set(start, -1);
  let frontier = [from];
  for (let step = 0; frontier.length && step < maxSteps; step++) {
    const next: Cell[] = [];
    for (const c of frontier) for (const d of DIRS) {
      if (!canStep(m, c, d)) continue;
      const n = add(c, d);
      const k = idx(m, n);
      if (prev.has(k)) continue;
      const goal = same(n, to);
      if (!goal && blocked?.(n)) continue;
      prev.set(k, idx(m, c));
      if (goal) {
        const out: Cell[] = [];
        for (let at = k; at !== start; at = prev.get(at)!) out.push({ x: at % m.w, y: Math.floor(at / m.w) });
        return out.reverse();
      }
      next.push(n);
    }
    frontier = next;
  }
  return null;
}

/** Walking distance from `from` to every reachable cell (BFS layers). */
export function distanceMap(m: GridMap, from: Cell): Int32Array {
  const d = new Int32Array(m.w * m.h).fill(-1);
  d[idx(m, from)] = 0;
  let frontier = [from];
  for (let step = 1; frontier.length; step++) {
    const next: Cell[] = [];
    for (const c of frontier) for (const dir of DIRS) {
      if (!canStep(m, c, dir)) continue;
      const n = add(c, dir);
      if (d[idx(m, n)] !== -1) continue;
      d[idx(m, n)] = step;
      next.push(n);
    }
    frontier = next;
  }
  return d;
}
