import { canStep, DIRS, idx, walkable, tileAt, type Cell, type GEvent, type GridMap } from '../grid/types';
import { alive, entOf } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';
import type { Building } from './buildings';
import { damageModule, footprint } from './modules';

/** a barricade that stands in a raider's way (a broken one is open ground) */
export const blocks = (b: Building): boolean => !b.broken;

/**
 * What a raid is after (spec 2026-10-09 §2.3, as a RimWorld raid goes): the pod and every module still standing. Raiders
 * make for the nearest and hack at it; a module broken is left alone, the pod's fall ends the raid.
 */
export const POD = 'pod';
export interface Target { id: string; cells: Cell[] }
export const targets = (p: WorldParty): Target[] => [{ id: POD, cells: footprint(p.base) }, ...(p.modules ?? []).filter((m) => !m.broken).map((m) => ({ id: `module-${m.id}`, cells: footprint(m.at) }))];

/**
 * What a walled cell costs to cross (spec 2026-10-09 §2.3). The horde follows any open road, however long, before it breaks
 * anything: a wall costs far more than the longest way round — and of the walls a clone is the cheaper, so a sealed base is
 * stormed at the clone that plugs it. Elites go nearly straight: to them a wall is only a few steps' work.
 */
const FLOW = { barricade: 1000, clone: 400 }, BREACH = { barricade: 4, clone: 6 };
type Costs = typeof FLOW;

interface Fields { key: string; flow: Float64Array; breach: Float64Array; trial: GridMap; walls: Map<number, 'barricade' | 'clone'>;
  /** the cells a target can be struck from (beside its footprint), each with the target it reaches */
  near: Map<number, string> }
const cache = new WeakMap<WorldParty, Fields>();
export const resetRaidPath = (p: WorldParty): void => { cache.delete(p); };

/** the clones standing on the ground (each is a wall tile to the horde) */
const cloneCells = (p: WorldParty): number[] => p.units.filter((u) => u.side === 'hero' && !u.summoner && alive(p, u)).map((u) => idx(p.s.map, entOf(p, u.id)!.pos));

/** Cost to the nearest target from every cell (reverse Dijkstra; Infinity where nothing leads): a walled cell is floor that costs its breaking. */
function field(p: WorldParty, trial: Fields['trial'], walls: Fields['walls'], near: Fields['near'], costs: Costs): Float64Array {
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
  // the goal: the cells beside any target (one that is walled is reached only by breaking it)
  for (const k of near.keys()) { const d = walls.has(k) ? cost(k) : 0; distances[k] = d; push(k, d); }
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
  const key = `${p.buildings.map((b) => `${b.id}${b.broken ? 'x' : ''}`).join(',')}|${clones.join(',')}|${(p.modules ?? []).map((x) => `${x.id}${x.at.x},${x.at.y}${x.broken ? 'x' : ''}`).join(',')}`;
  const entry = cache.get(p);
  if (entry && entry.key === key) return entry;
  const trial = { ...m, tiles: [...m.tiles] }, walls: Fields['walls'] = new Map();
  for (const k of clones) walls.set(k, 'clone');
  for (const b of p.buildings) if (blocks(b)) { trial.tiles[idx(m, b.at)] = 'floor'; walls.set(idx(m, b.at), 'barricade'); }
  const near: Fields['near'] = new Map();
  // the pod first: a cell beside both it and a module strikes the pod
  for (const t of targets(p)) for (const c of t.cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const n = { x: c.x + dx, y: c.y + dy }, k = idx(m, n);
    if (walkable(tileAt(trial, n)) && !near.has(k)) near.set(k, t.id);
  }
  const made: Fields = { key, trial, walls, near, flow: field(p, trial, walls, near, FLOW), breach: field(p, trial, walls, near, BREACH) };
  cache.set(p, made);
  return made;
}

/** The horde's field: the cost to the nearest target from every cell, open roads first. */
export const raidField = (p: WorldParty): Float64Array => fields(p).flow;
/** the walled cells (barricades standing, clones on their feet), by cell index */
export const raidWalls = (p: WorldParty): Map<number, 'barricade' | 'clone'> => fields(p).walls;
/** the target a raider standing on the cell can strike (the pod, a standing module), if any */
export const targetNear = (p: WorldParty, c: Cell): string | undefined => fields(p).near.get(idx(p.s.map, c));

/** A raider's blow on a target: the pod loses health; a module at nothing breaks (the horde turns to what still stands). */
export function hitTarget(p: WorldParty, id: string, n: number, src: string, ev: GEvent[]): void {
  const t = p.time;
  if (id === POD) { p.podHp = Math.max(0, p.podHp - n); ev.push({ t, type: 'hit', src, dst: POD, to: { x: p.base.x + 0.5, y: p.base.y + 0.5 }, amount: n }); return; }
  const m = p.modules?.find((x) => `module-${x.id}` === id);
  if (!m || m.broken) return;
  const to = { x: m.at.x + 0.5, y: m.at.y + 0.5 }, broke = damageModule(m, n);
  ev.push({ t, type: 'hit', src, dst: id, to, amount: n });
  if (broke) { resetRaidPath(p); ev.push({ t, type: 'die', src, dst: id, to }); }
}

/** whether a target can be walked to without breaking anything (the horde flows) or only through a wall (it storms) */
export const roadOpen = (p: WorldParty, from: Cell): boolean => (fields(p).flow[idx(p.s.map, from)] ?? Infinity) < FLOW.clone;

/** The next cell toward the nearest target for an elite on the grid: nearly straight, through whatever stands there. */
export function raidStep(p: WorldParty, from: Cell): Cell | undefined {
  const m = p.s.map, f = fields(p);
  return DIRS.filter((dir) => canStep(f.trial, from, dir)).map((dir) => ({ x: from.x + dir.x, y: from.y + dir.y }))
    .filter((c) => Number.isFinite(f.breach[idx(m, c)]))
    .sort((a, b) => f.breach[idx(m, a)]! - f.breach[idx(m, b)]!)[0];
}
