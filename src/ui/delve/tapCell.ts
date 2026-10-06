import { distanceMap } from '../../sim/grid/path';
import { idx, tileAt, walkable, type Cell, type GridMap } from '../../sim/grid/types';

/**
 * Where a tap sends a clone: the tapped cell if it can stand there, else the nearest reachable open cell beside it
 * (an ore vein, a chest, a shrine, a wall): standing next to those is what works them. Null when nothing beside it is reachable.
 */
export function tapCell(m: GridMap, from: Cell, c: Cell, free: (c: Cell) => boolean): Cell | null {
  if (c.x < 0 || c.y < 0 || c.x >= m.w || c.y >= m.h) return null;
  if (walkable(tileAt(m, c))) return c;
  const d = distanceMap(m, from);
  let best: Cell | null = null, bd = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const n = { x: c.x + dx, y: c.y + dy };
    if ((!dx && !dy) || n.x < 0 || n.y < 0 || n.x >= m.w || n.y >= m.h) continue;
    const k = d[idx(m, n)]!;
    if (k < 0 || !walkable(tileAt(m, n)) || (k > 0 && !free(n))) continue;
    if (k < bd) { bd = k; best = n; }
  }
  return best;
}
