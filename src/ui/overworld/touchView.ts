/** phones and tablets: shadows off, a lower resolution, bigger buttons */
export const coarsePointer = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** an upright phone: its bottom row has no attack key (a foe is tapped), so no foe wears the key's mark */
export const phoneUpright = (): boolean => typeof matchMedia === 'function' && matchMedia('(orientation: portrait) and (max-width: 700px)').matches;

/** A good starting view height (in cells) for the screen's shape: an upright phone sees more rows, a short landscape phone fewer. */
export function startZoom(base: number): number {
  const w = innerWidth, h = innerHeight;
  if (h > w) return base * 1.45;
  if (h < 520) return base * 0.85;
  return base;
}

/**
 * Two fingers pinch the view in and out; a tap stays a tap. `tapped` says whether the last pointer-up ended a real tap
 * (no pinch, little movement), so the stage's click handler can ignore the end of a pinch or a drag.
 */
export class Pinch {
  private readonly pts = new Map<number, { x: number; y: number; x0: number; y0: number }>();
  private startDist = 0;
  private startZoom = 0;
  private pinched = false;
  private moved = false;

  /** also: other surfaces over the field that take touches (the stick's zone), so a pinch with a finger on them still counts; `onPinch` when two fingers land */
  constructor(stage: HTMLElement, private readonly zoom: () => number, private readonly setZoom: (z: number) => void, also: HTMLElement[] = [], onPinch?: () => void) {
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!this.pts.size) { this.pinched = false; this.moved = false; }
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
      if (this.pts.size === 2) { this.startDist = this.spread(); this.startZoom = this.zoom(); this.pinched = true; onPinch?.(); }
    };
    const move = (e: PointerEvent) => {
      const p = this.pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      // a thumb drifts as it taps: only a real drag (beyond ~a fingertip) stops a tap counting
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 28) this.moved = true;
      if (this.pts.size === 2 && this.startDist > 0) this.setZoom(this.startZoom * (this.startDist / Math.max(20, this.spread())));
    };
    const up = (e: PointerEvent) => { this.pts.delete(e.pointerId); if (this.pts.size < 2) this.startDist = 0; };
    for (const el of [stage, ...also]) {
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    }
    stage.style.touchAction = 'none';
  }

  /** whether the pointer that just went up made a plain tap */
  get tapped(): boolean { return !this.pinched && !this.moved; }

  private spread(): number {
    const [a, b] = [...this.pts.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
