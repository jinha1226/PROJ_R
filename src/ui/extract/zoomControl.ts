import { clampZoom, loadZoom, pinchHeight, saveZoom, wheelHeight, type ZoomByLayout } from '../../app/input/zoom';
import type { IsoCamera } from '../../view/explore/exploreCamera';
import type { Layout } from './orientation';

const STEP = 1.25;
type Pt = { x: number; y: number };
const gap = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Zoom for the sortie camera: +/− buttons, mouse wheel and a two-finger pinch on open ground; remembered per orientation. */
export class ZoomControl {
  readonly el = document.createElement('div');
  private readonly z: ZoomByLayout = loadZoom();
  private layout: Layout = 'landscape';
  private readonly touches = new Map<number, Pt>();
  private pinch: { d0: number; h0: number } | null = null;

  constructor(private readonly cam: IsoCamera, private readonly stage: HTMLElement) {
    this.el.className = 'xzoom';
    this.el.innerHTML = '<button class="btn" data-z="in" data-testid="zoom-in">＋</button><button class="btn" data-z="out" data-testid="zoom-out">−</button>';
    this.el.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-z]')?.dataset.z;
      if (k) this.set(this.height / (k === 'in' ? STEP : 1 / STEP));
    });
    stage.addEventListener('wheel', this.onWheel, { passive: false });
    stage.addEventListener('pointerdown', this.onDown);
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

  private set(h: number): void {
    this.z[this.layout] = clampZoom(h);
    this.cam.setHeight(this.height);
    saveZoom(this.z);
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.set(wheelHeight(this.height, e.deltaY));
  };

  // the stick pad and the buttons sit above the stage, so only touches on open ground get here
  private readonly onDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...this.touches.values()];
    if (a && b && this.touches.size === 2) this.pinch = { d0: gap(a, b), h0: this.height };
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (!this.touches.has(e.pointerId)) return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...this.touches.values()];
    if (this.pinch && a && b) this.set(pinchHeight(this.pinch.h0, this.pinch.d0, gap(a, b)));
  };

  private readonly onUp = (e: PointerEvent): void => {
    this.touches.delete(e.pointerId);
    if (this.touches.size < 2) this.pinch = null;
  };

  dispose(): void {
    this.stage.removeEventListener('wheel', this.onWheel);
    this.stage.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.el.remove();
  }
}
