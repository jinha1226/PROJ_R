import { idx, same, type Cell, type GridState } from '../../sim/grid/types';
import { mouseHoverTarget } from './mouseAim';
import { plannedPath } from './plannedPath';

/**
 * With a mouse over a seen floor cell, the walk a click would take is drawn on the floor (a foe under the cursor is
 * attacked, not walked to, so it shows none). It follows the hero as it moves and clears when the cursor leaves.
 */
export class HoverPath {
  private cell: Cell | null = null;
  private key = '';
  private readonly off: () => void;

  constructor(stage: HTMLElement, private readonly state: () => GridState, cellAt: (x: number, y: number) => Cell | null | undefined,
    private readonly enabled: () => boolean, private readonly show: (cells: Cell[] | null) => void) {
    const move = (e: PointerEvent) => { if (e.pointerType === 'mouse') { this.cell = cellAt(e.clientX, e.clientY) ?? null; this.refresh(); } };
    const leave = () => { this.cell = null; this.refresh(); };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerleave', leave);
    this.off = () => { stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerleave', leave); };
  }

  /** Recompute when the cursor, the hero or the world changed (cheap when nothing did). */
  refresh(): void {
    const s = this.state(), c = this.cell;
    const key = c && this.enabled() ? `${c.x},${c.y}|${s.hero.pos.x},${s.hero.pos.y}|${s.time}` : '';
    if (key === this.key) return;
    this.key = key;
    if (!c || !key || same(c, s.hero.pos) || !s.seen[idx(s.map, c)] || mouseHoverTarget(s, c)) { this.show(null); return; }
    this.show(plannedPath(s, c, true));
  }

  dispose(): void { this.off(); this.show(null); }
}
