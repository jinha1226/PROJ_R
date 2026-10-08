import { canStep, DIRS, dist, idx, walkable, tileAt, type Cell, type GridMap } from '../grid/types';
import { alive, entOf } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';
import type { Building } from './buildings';

/** a barricade that stands in a raider's way (a broken one is open ground) */
export const blocks = (b: Building): boolean => !b.broken;
export const podReach = (p: WorldParty, c: Cell): boolean => [p.base, { x: p.base.x + 1, y: p.base.y }, { x: p.base.x, y: p.base.y + 1 }, { x: p.base.x + 1, y: p.base.y + 1 }].some(at => dist(c, at) <= 1);

/**
 * What a walled cell costs to cross (spec 2026-10-09 §2.3). The horde follows any open road, however long, before it breaks
 * anything: a wall costs far more than the longest way round — and of the walls a clone is the cheaper, so a sealed base is
 * stormed at the clone that plugs it. Elites go nearly straight: to them a wall is only a few steps' work.
 */
const FLOW = { barricade: 1000, clone: 400 }, BREACH = { barricade: 4, clone: 6 };
type Costs = typeof FLOW;

interface Fields { key: string; flow: Float64Array; breach: Float64Array; trial: GridMap; walls: Map<number, 'barricade' | 'clone'> }
const cache = new WeakMap<WorldParty, Fields>();
export const resetRaidPath = (p: WorldParty): void => { cache.delete(p); };

/** the clones standing on the ground (each is a wall tile to the horde) */
const cloneCells = (p: WorldParty): number[] => p.units.filter((u) => u.side === 'hero' && !u.summoner && alive(p, u)).map((u) => idx(p.s.map, entOf(p, u.id)!.pos));

/** Cost to the pod from every cell (reverse Dijkstra; Infinity where nothing leads): a walled cell is floor that costs its breaking. */
function field(p: WorldParty, trial: Fields['trial'], walls: Fields['walls'], costs: Costs): Float64Array {
  const m = p.s.map;
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
  const cost = (k: number) => { const w = walls.get(k); return w ? costs[w] : 1; };
  // the goal: the cells round the pod (one that is walled is reached only by breaking it)
  for (let y = p.base.y - 1; y <= p.base.y + 2; y++) for (let x = p.base.x - 1; x <= p.base.x + 2; x++) {
    const c = { x, y }; if (!walkable(tileAt(trial, c))) continue;
    const k = idx(m, c), d = walls.has(k) ? cost(k) : 0;
    distances[k] = d; push(k, d);
  }
  while (heap.length) {
    const cur = pop(); if (cur.d !== distances[cur.k]) continue;
    const c = { x: cur.k % m.w, y: Math.floor(cur.k / m.w) };
    for (const dir of DIRS) {
      if (!canStep(trial, c, dir)) continue;
      const k = idx(m, { x: c.x + dir.x, y: c.y + dir.y }), d = cur.d + cost(k);
      if (d < distances[k]!) { distances[k] = d; push(k, d); }
    }
  }
  return distances;
}

function fields(p: WorldParty): Fields {
  const m = p.s.map, clones = cloneCells(p);
  const key = `${p.buildings.map((b) => `${b.id}${b.broken ? 'x' : ''}`).join(',')}|${clones.join(',')}`;
  const entry = cache.get(p);
  if (entry && entry.key === key) return entry;
  const trial = { ...m, tiles: [...m.tiles] }, walls: Fields['walls'] = new Map();
  for (const k of clones) walls.set(k, 'clone');
  for (const b of p.buildings) if (blocks(b)) { trial.tiles[idx(m, b.at)] = 'floor'; walls.set(idx(m, b.at), 'barricade'); }
  const made: Fields = { key, trial, walls, flow: field(p, trial, walls, FLOW), breach: field(p, trial, walls, BREACH) };
  cache.set(p, made);
  return made;
}

/** The horde's field: the cost to the pod from every cell, open roads first. */
export const raidField = (p: WorldParty): Float64Array => fields(p).flow;
/** the walled cells (barricades standing, clones on their feet), by cell index */
export const raidWalls = (p: WorldParty): Map<number, 'barricade' | 'clone'> => fields(p).walls;
/** whether the pod can be walked to without breaking anything (the horde flows) or only through a wall (it storms) */
export const roadOpen = (p: WorldParty, from: Cell): boolean => (fields(p).flow[idx(p.s.map, from)] ?? Infinity) < FLOW.clone;

/** The next cell toward the pod for an elite on the grid: nearly straight, through whatever stands there. */
export function raidStep(p: WorldParty, from: Cell): Cell | undefined {
  const m = p.s.map, f = fields(p);
  return DIRS.filter((dir) => canStep(f.trial, from, dir)).map((dir) => ({ x: from.x + dir.x, y: from.y + dir.y }))
    .filter((c) => Number.isFinite(f.breach[idx(m, c)]))
    .sort((a, b) => f.breach[idx(m, a)]! - f.breach[idx(m, b)]!)[0];
}
