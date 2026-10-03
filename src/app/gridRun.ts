import type { RunOptions } from '../sim/grid/runSetup';
import { GridSim } from '../sim/grid/gridSim';
import { settleRun, type MetaState } from '../sim/grid/meta';
import { fromSave, toSave } from '../sim/grid/save';
import type { GridState } from '../sim/grid/types';
import { loadMeta, saveMeta } from './gridMeta';
const KEY = 'projr.grid.run.v1';
export function loadRun(): GridState | null {
  try {
    const text = localStorage.getItem(KEY);
    if (text === null) return null;
    const s = fromSave(text);
    return s.outcome ? null : s;
  } catch { return null; }
}
export function saveRun(s: GridState): void {
  try { localStorage.setItem(KEY, toSave(s)); } catch { /* storage unavailable */ }
}
export function clearRun(): void {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
export interface GridRunSession { sim: GridSim; readonly meta: MetaState; checkpoint(): void }
function session(sim: GridSim, meta = loadMeta()): GridRunSession {
  let settled = false;
  return { sim, get meta() { return meta; }, checkpoint: () => {
    if (settled) return;
    if (sim.s.outcome) {
      meta = settleRun(meta, sim.s);
      saveMeta(meta);
      clearRun();
      settled = true;
    } else saveRun(sim.s);
  } };
}
export function startGridRun(seed: number, opts: RunOptions = { gun: 'pistol', start: 1, startSuit: [] }, meta = loadMeta()): GridRunSession {
  const run = session(GridSim.createRun(seed, meta, opts), meta);
  run.checkpoint();
  return run;
}
/** Run B can offer this from the ship without changing run creation or serialization. */
export function continueGridRun(): GridRunSession | null {
  const s = loadRun();
  return s ? session(GridSim.fromState(s)) : null;
}
