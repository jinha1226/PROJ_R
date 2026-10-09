import { canStep, DIRS, idx, tileAt, walkable, type Cell, type GridMap } from '../grid/types';
import type { WorldParty } from '../overworld/worldSim';
import { domeR } from './siege';

/** whether a cell lies under the dome (its middle within the dome's reach of the base's middle) */
export const inDome = (p: WorldParty, c: Cell): boolean => Math.hypot(c.x + 0.5 - (p.base.x + 1), c.y + 0.5 - (p.base.y + 1)) < domeR(p);

interface Field { r: number; steps: Int32Array; rim: Set<number>; trial: GridMap }
const cache = new WeakMap<WorldParty, Field>();
export const resetSiegePath = (p: WorldParty): void => { cache.delete(p); };

/**
 * The horde's way in: from every cell, how many steps to the dome's rim (the open cells just outside it) — a flood from the
 * rim outward over open ground, the dome itself shut. -1 where nothing leads.
 */
function field(p: WorldParty): Field {
  const m = p.s.map, r = domeR(p), kept = cache.get(p);
  if (kept && kept.r === r) return kept;
  const trial = { ...m, tiles: [...m.tiles] }, rim = new Set<number>();
  const cx = p.base.x + 1, cy = p.base.y + 1, span = Math.ceil(r) + 2;
  for (let y = cy - span; y <= cy + span; y++) for (let x = cx - span; x <= cx + span; x++) if (inDome(p, { x, y })) trial.tiles[idx(m, { x, y })] = 'wall';
  for (let y = cy - span; y <= cy + span; y++) for (let x = cx - span; x <= cx + span; x++) {
    const c = { x, y };
    if (inDome(p, c) || !walkable(tileAt(m, c))) continue;
    if (DIRS.some((d) => inDome(p, { x: x + d.x, y: y + d.y }))) rim.add(idx(m, c));
  }
  const steps = new Int32Array(m.w * m.h).fill(-1);
  let frontier: number[] = [...rim];
  for (const k of frontier) steps[k] = 0;
  for (let step = 1; frontier.length; step++) {
    const next: number[] = [];
    for (const k of frontier) {
      const c = { x: k % m.w, y: Math.floor(k / m.w) };
      for (const d of DIRS) {
        if (!canStep(trial, c, d)) continue;
        const n = idx(m, { x: c.x + d.x, y: c.y + d.y });
        if (steps[n] !== -1) continue;
        steps[n] = step; next.push(n);
      }
    }
    frontier = next;
  }
  const made = { r, steps, rim, trial };
  cache.set(p, made);
  return made;
}

/** steps to the dome's rim from every cell (-1: no way) */
export const siegeField = (p: WorldParty): Int32Array => field(p).steps;
/** the open cells just outside the dome: where the horde stands to hack at it */
export const rimOf = (p: WorldParty): Set<number> => field(p).rim;

/** The next cell toward the rim for a raider on the grid (an elite): the neighbour with the fewest steps left. */
export function siegeStep(p: WorldParty, from: Cell): Cell | undefined {
  const m = p.s.map, f = field(p);
  return DIRS.filter((d) => canStep(f.trial, from, d)).map((d) => ({ x: from.x + d.x, y: from.y + d.y }))
    .filter((c) => f.steps[idx(m, c)]! >= 0)
    .sort((a, b) => f.steps[idx(m, a)]! - f.steps[idx(m, b)]!)[0];
}
