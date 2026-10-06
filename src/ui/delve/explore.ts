import { distanceMap } from '../../sim/grid/path';
import { idx, tileAt, walkable, type Cell, type GridState } from '../../sim/grid/types';

/**
 * Where "explore" walks next (as Jupiter Hell's auto-explore): the nearest reachable open cell the party has seen that
 * borders a cell it has not. Null when nothing is left to uncover within reach.
 */
export function frontier(s: GridState, from: Cell): Cell | null {
  const m = s.map, d = distanceMap(m, from);
  let best: Cell | null = null, bd = Infinity;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = idx(m, { x, y }), k = d[i]!;
    if (k <= 0 || k >= bd || !s.seen[i] || !walkable(tileAt(m, { x, y }))) continue;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1 && !edge; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && !s.seen[ny * m.w + nx]) edge = true;
    }
    if (edge) { bd = k; best = { x, y }; }
  }
  return best;
}

/** Auto-explore that keeps going: each time the clone is not on its way somewhere, it heads for the next frontier, until a fight, nothing left, or the player takes over. */
export class AutoExplore {
  on = false;
  start(): void { this.on = true; }
  stop(): void { this.on = false; }

  /** One look per frame; `say` gets a line when exploring ends on its own. */
  step(s: GridState, from: Cell | undefined, moving: boolean, fighting: boolean, go: (c: Cell) => void, say: (text: string) => void): void {
    if (!this.on || moving || !from) return;
    if (fighting) { this.on = false; return; }
    const c = frontier(s, from);
    if (c) go(c); else { this.on = false; say('더 갈 곳 없음'); }
  }
}
