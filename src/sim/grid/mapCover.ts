import type { Rng } from '../../core/rng';
import { distanceMap } from './path';
import { add, DIRS, idx, tileAt, type Cell, type GridMap } from './types';

/** Low walls use the map's RNG, after all reserved features have been placed. */
export function placeCover(m: GridMap, rng: Rng): void {
  const reserved = new Set([m.start, ...m.exits, ...m.chests, ...(m.barrels ?? []),
    ...(m.stairs ? [m.stairs] : []), ...(m.traps ?? []).map(t => t.pos), ...m.spawns.map(f => f.pos),
    ...(m.toolSpots ?? []).flatMap(t => [t.pos, t.reward, ...DIRS.map(d => add(t.pos, d))])].map(c => idx(m, c)));
  let reachable = distanceMap(m, m.start);
  for (const r of m.rooms) {
    const inside = (c: Cell) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h;
    if (inside(m.start)) continue;
    const floors: Cell[] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (tileAt(m, { x, y }) === 'floor') floors.push({ x, y });
    }
    const min = Math.min(6, Math.ceil(floors.length * 0.04));
    const max = Math.min(6, Math.floor(floors.length * 0.1));
    if (max < min) continue;
    const goal = rng.int(min, max);
    const safe = (c: Cell) => inside(c) && tileAt(m, c) === 'floor' && reachable[idx(m, c)]! >= 0
      && !reserved.has(idx(m, c)) && !DIRS.some(d => ['door', 'open'].includes(tileAt(m, add(c, d))));
    const edge = (c: Cell) => c.x === r.x || c.x === r.x + r.w - 1 || c.y === r.y || c.y === r.y + r.h - 1;
    const candidates = rng.shuffle(floors.filter(safe)).sort((a, b) => Number(edge(a)) - Number(edge(b)));
    let placed = 0;
    for (const c of candidates) {
      if (placed >= goal) break;
      if (!safe(c)) continue;
      const dir = rng.pick(DIRS.slice(0, 4)), run: Cell[] = [];
      const length = rng.int(1, Math.min(3, goal - placed));
      for (let n = 0; n < length; n++) {
        const next = { x: c.x + dir.x * n, y: c.y + dir.y * n };
        if (!safe(next) || (n > 0 && !edge(c) && edge(next))) break;
        run.push(next);
      }
      // Try the short run first, then shorter prefixes when the full run cuts access.
      while (run.length) {
        for (const cell of run) m.tiles[idx(m, cell)] = 'cover';
        const after = distanceMap(m, m.start);
        const disconnected = reachable.some((d, k) => d >= 0 && m.tiles[k] !== 'cover' && after[k]! < 0);
        if (!disconnected) { placed += run.length; reachable = after; break; }
        for (const cell of run) m.tiles[idx(m, cell)] = 'floor';
        run.pop();
      }
    }
  }
}
