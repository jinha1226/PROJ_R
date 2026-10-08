import { canStep, DIRS, dist, idx, walkable, tileAt, type Cell } from '../grid/types';
import type { WorldParty } from '../overworld/worldSim';
import { footprint, type Building } from './buildings';

/** a building that stands in a raider's way (palisades and mines are walked over; broken ones are rubble) */
export const blocks = (b: Building): boolean => !b.broken && b.kind !== 'palisade' && b.kind !== 'shockMine';
export const podReach = (p: WorldParty, c: Cell): boolean => [p.base, { x: p.base.x + 1, y: p.base.y }, { x: p.base.x, y: p.base.y + 1 }, { x: p.base.x + 1, y: p.base.y + 1 }].some(at => dist(c, at) <= 1);
const cache = new WeakMap<WorldParty, { key: string; distances: Float64Array }>();
export const resetRaidPath = (p: WorldParty): void => { cache.delete(p); };
/** the costed map the raid paths over: breakable buildings stand as floor that costs eight steps to cross (break) */
function trialOf(p: WorldParty) {
  const m = p.s.map, trial = { ...m, tiles: [...m.tiles] }, costs = new Map<number, number>();
  for (const b of p.buildings) if (blocks(b)) for (const c of footprint(b.kind, b.at)) {
    trial.tiles[idx(m, c)] = 'floor'; costs.set(idx(m, c), 8);
  }
  return { trial, costs };
}

/** Distance to the pod from every cell (reverse Dijkstra shared by the whole raid; Infinity where nothing leads). */
export function raidField(p: WorldParty): Float64Array {
  const m = p.s.map, key = p.buildings.map(b => `${b.id}${b.broken ? 'x' : ''}`).join(',');
  const entry = cache.get(p);
  if (entry && entry.key === key) return entry.distances;
  const { trial, costs } = trialOf(p);
  const distances = new Float64Array(m.w * m.h).fill(Infinity);
  const heap: { k: number; d: number }[] = [];
  const push = (k: number, d: number) => {
    let i = heap.length; heap.push({ k, d });
    while (i > 0) { const parent = (i - 1) >> 1; if (heap[parent]!.d <= d) break; heap[i] = heap[parent]!; i = parent; }
    heap[i] = { k, d };
  };
  const pop = () => {
    const top = heap[0]!, last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1; if (child + 1 < heap.length && heap[child + 1]!.d < heap[child]!.d) child++;
        if (heap[child]!.d >= last.d) break;
        heap[i] = heap[child]!; i = child;
      }
      heap[i] = last;
    }
    return top;
  };
  for (let y = p.base.y - 1; y <= p.base.y + 2; y++) for (let x = p.base.x - 1; x <= p.base.x + 2; x++) {
    const c = { x, y }; if (walkable(tileAt(trial, c))) { distances[idx(m, c)] = 0; push(idx(m, c), 0); }
  }
  while (heap.length) {
    const cur = pop(); if (cur.d !== distances[cur.k]) continue;
    const c = { x: cur.k % m.w, y: Math.floor(cur.k / m.w) };
    for (const dir of DIRS) {
      if (!canStep(trial, c, dir)) continue;
      const n = { x: c.x + dir.x, y: c.y + dir.y }, k = idx(m, n), d = cur.d + (costs.get(cur.k) ?? 1);
      if (d < distances[k]!) { distances[k] = d; push(k, d); }
    }
  }
  cache.set(p, { key, distances });
  return distances;
}

/** The next cell toward the pod for a raider on the grid (elites; the fodder flow by `raidField` themselves). */
export function raidStep(p: WorldParty, from: Cell): Cell | undefined {
  const m = p.s.map, distances = raidField(p), { trial, costs } = trialOf(p);
  return DIRS.filter(dir => canStep(trial, from, dir)).map(dir => ({ x: from.x + dir.x, y: from.y + dir.y }))
    .filter(c => Number.isFinite(distances[idx(m, c)]))
    .sort((a, b) => distances[idx(m, a)]! + (costs.get(idx(m, a)) ?? 1) - distances[idx(m, b)]! - (costs.get(idx(m, b)) ?? 1))[0];
}
