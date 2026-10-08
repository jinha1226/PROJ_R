/**
 * Base mode's camera (spec 2026-10-08 §1): free of the clones — a drag or WASD / the arrows pan it, the wheel zooms (the
 * screen keeps the zoom). `aim` is in cells; a pointer-up that ended a drag is not a click (`dragged`).
 */
const KEYS: Record<string, [number, number]> = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0], arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0] };

export class BaseCamera {
  aim = { x: 0, y: 0 };
  dragged = false;
  on = false;
  /** whether a mouse drag pans (base mode); a finger always does */
  mouse = true;
  private readonly held = new Set<string>();
  private drag: { x: number; y: number; moved: boolean } | null = null;

  constructor(private readonly stage: HTMLElement, private readonly zoom: () => number, private readonly bounds: () => { w: number; h: number }) {
    stage.addEventListener('pointerdown', (e) => { if (this.on && e.button === 0 && e.isPrimary && (this.mouse || e.pointerType !== 'mouse')) { this.drag = { x: e.clientX, y: e.clientY, moved: false }; this.dragged = false; } });
    addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || !this.on) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true; this.dragged = true;
      // the view is `zoom` cells tall; the ground is foreshortened by the 45° tilt
      const per = this.zoom() / Math.max(1, this.stage.clientHeight);
      this.pan(-dx * per, -dy * per * Math.SQRT2);
      d.x = e.clientX; d.y = e.clientY;
    });
    addEventListener('pointerup', () => { this.drag = null; });
    addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (this.on && KEYS[k] && !e.repeat) this.held.add(k); });
    addEventListener('keyup', (e) => { this.held.delete(e.key.toLowerCase()); });
    addEventListener('blur', () => this.held.clear());
  }

  centerOn(c: { x: number; y: number }): void { this.aim = { x: c.x, y: c.y }; }
  /** held keys pan at about a screen's width in two seconds */
  update(dt: number): void {
    if (!this.on) { this.held.clear(); return; }
    let x = 0, y = 0;
    for (const k of this.held) { x += KEYS[k]![0]; y += KEYS[k]![1]; }
    if (x || y) this.pan(x * this.zoom() * 0.6 * dt, y * this.zoom() * 0.6 * dt);
  }
  private pan(dx: number, dy: number): void {
    const b = this.bounds();
    this.aim = { x: Math.max(0, Math.min(b.w - 1, this.aim.x + dx)), y: Math.max(0, Math.min(b.h - 1, this.aim.y + dy)) };
  }
}
