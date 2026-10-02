import { clampZoom, loadZoom, pinchHeight, saveZoom, wheelHeight, type ZoomByLayout } from '../../app/input/zoom';
import type { Layout } from './orientation';

const STEP = 1.25;
/** a second finger this soon after the first one landed on the stick pad means a pinch, not steering */
const PINCH_GRACE_MS = 250;
type Pt = { x: number; y: number };
/** Anything with a view height (the sortie's IsoCamera, the grid runtime). */
export interface Zoomable { setHeight(h: number): void }
export interface ZoomOpts { key?: string; defaults?: ZoomByLayout; pad?: string; stage?: string }
const gap = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Zoom for the sortie camera: +/− buttons, mouse wheel and a two-finger pinch on open ground; remembered per orientation. */
export class ZoomControl {
  readonly el = document.createElement('div');
  private readonly z: ZoomByLayout;
  private layout: Layout = 'landscape';
  private readonly touches = new Map<number, Pt & { pad: boolean; at: number }>();
  private pinch: { d0: number; h0: number } | null = null;

  constructor(private readonly cam: Zoomable, private readonly stage: HTMLElement, private readonly onPinch: () => void = () => undefined, private readonly opts: ZoomOpts = {}) {
    this.z = loadZoom(undefined, opts.key, opts.defaults);
    this.el.className = 'xzoom';
    this.el.innerHTML = '<button class="btn" data-z="in" data-testid="zoom-in">＋</button><button class="btn" data-z="out" data-testid="zoom-out">−</button>';
    this.el.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-z]')?.dataset.z;
      if (k) this.set(this.height / (k === 'in' ? STEP : 1 / STEP));
    });
    stage.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('pointerdown', this.onDown, true);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  get height(): number {
    return this.z[this.layout];
  }

  /** The screen turned: use the zoom remembered for that orientation. */
  setLayout(l: Layout): void {
    this.layout = l;
    this.cam.setHeight(this.height);
  }

  private set(h: number, save = true): void {
    this.z[this.layout] = clampZoom(h);
    this.cam.setHeight(this.height);
    if (save) saveZoom(this.z, undefined, this.opts.key);
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.set(wheelHeight(this.height, e.deltaY));
  };

  // touches on buttons and panels never count; a touch on the stick pad counts only if the second finger follows quickly
  private readonly onDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    const t = e.target as Element | null;
    const pad = this.opts.pad ?? '.tc-pad';
    if (!t?.closest?.(`${pad}, ${this.opts.stage ?? '.sortie-stage'}`)) return;
    const now = performance.now();
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, pad: !!t.closest(pad), at: now });
    const [a, b] = [...this.touches.values()];
    if (!a || !b || this.touches.size !== 2) return;
    const first = a.at <= b.at ? a : b;
    if (first.pad && now - first.at > PINCH_GRACE_MS) return;
    this.pinch = { d0: gap(a, b), h0: this.height };
    this.onPinch();
    // a second finger landing on the pad must not start a stick of its own
    e.stopPropagation();
  };

  private readonly onMove = (e: PointerEvent): void => {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    this.touches.set(e.pointerId, { ...t, x: e.clientX, y: e.clientY });
    const [a, b] = [...this.touches.values()];
    if (this.pinch && a && b) this.set(pinchHeight(this.pinch.h0, this.pinch.d0, gap(a, b)), false);
  };

  private readonly onUp = (e: PointerEvent): void => {
    this.touches.delete(e.pointerId);
    if (this.touches.size < 2 && this.pinch) {
      this.pinch = null;
      saveZoom(this.z, undefined, this.opts.key);
    }
  };

  dispose(): void {
    this.stage.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointerdown', this.onDown, true);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.el.remove();
  }
}
