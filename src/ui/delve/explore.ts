import { distanceMap } from '../../sim/grid/path';
import { idx, tileAt, walkable, type Cell, type GridState } from '../../sim/grid/types';
import { PACK_SIZE } from '../../sim/delve/gear';
import type { DelveParty } from '../../sim/delve/delveSim';
import type { RoamParty } from '../../sim/roam/roam';

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

/** Where to stand for the nearest reachable want: on it, or beside it when it cannot be stood on (a chest); `d` 0 means there already. */
export function nearestWant(s: GridState, from: Cell, wants: Cell[]): { at: Cell; want: Cell; d: number } | null {
  const m = s.map, dm = distanceMap(m, from);
  let best: { at: Cell; want: Cell; d: number } | null = null;
  for (const want of wants) {
    const spots = walkable(tileAt(m, want)) ? [want] : AROUND.map(([dx, dy]) => ({ x: want.x + dx, y: want.y + dy })).filter((c) => c.x >= 0 && c.y >= 0 && c.x < m.w && c.y < m.h && walkable(tileAt(m, c)));
    for (const at of spots) {
      const d = dm[idx(m, at)]!;
      if (d >= 0 && (!best || d < best.d)) best = { at, want, d };
    }
  }
  return best;
}
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;

/**
 * Auto-explore that keeps going: each time the clone is not on its way somewhere, it heads for the nearest thing to pick up
 * (`wants`: items, chests, souls in sight), else the next frontier, until a fight, nothing left, or the player takes over.
 */
export class AutoExplore {
  on = false;
  /** wants already reached (taken or not, e.g. a full pack): not walked back to */
  private done = new Set<string>();
  start(): void { this.on = true; this.done.clear(); }
  stop(): void { this.on = false; }

  /** One look per frame; `say` gets a line when exploring ends on its own. */
  step(s: GridState, from: Cell | undefined, moving: boolean, fighting: boolean, go: (c: Cell) => void, say: (text: string) => void, wants: Cell[] = []): void {
    if (!this.on || moving || !from) return;
    if (fighting) { this.on = false; return; }
    let want = nearestWant(s, from, wants.filter((w) => !this.done.has(`${w.x},${w.y}`)));
    while (want && want.d === 0) {
      this.done.add(`${want.want.x},${want.want.y}`);
      want = nearestWant(s, from, wants.filter((w) => !this.done.has(`${w.x},${w.y}`)));
    }
    const c = want?.at ?? frontier(s, from);
    if (c) go(c); else { this.on = false; say('더 갈 곳 없음'); }
  }
}

/** What auto-explore goes for: souls lying in sight, and (while the pack has room) items on the floor in sight and chests seen but shut. */
export function exploreWants(p: RoamParty & Partial<Pick<DelveParty, 'floorItems' | 'chests'>>): Cell[] {
  const m = p.s.map, seen = (c: Cell) => p.s.visible.has(idx(m, c)), room = p.pack.length < PACK_SIZE;
  return [
    ...p.souls.filter((o) => !o.taken && seen(o.pos)).map((o) => o.pos),
    ...(room ? (p.floorItems ?? []).filter((f) => seen(f.pos)).map((f) => f.pos) : []),
    ...(room ? (p.chests ?? []).filter((c) => !c.opened && p.s.seen[idx(m, c.pos)]).map((c) => c.pos) : []),
  ];
}
