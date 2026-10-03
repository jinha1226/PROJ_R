import type { WeaponGroup } from '../../sim/grid/items';
import type { GridCmd } from './gridControls';
import { icon, weaponIcon } from './icons';

const RADIUS = 56;
const BUTTONS: { cmd: GridCmd; label: string; ic: string; cls: string }[] = [
  { cmd: 'shoot', label: '사격', ic: 'pistol', cls: 'gt-fire' },
  { cmd: 'wait', label: '쉬기', ic: 'wait', cls: 'gt-wait' },
  { cmd: 'potion', label: '물약', ic: 'potion', cls: 'gt-potion' },
  { cmd: 'prev', label: '', ic: 'prev', cls: 'gt-prev' },
  { cmd: 'next', label: '', ic: 'next', cls: 'gt-next' },
  { cmd: 'swap', label: '교체', ic: 'swap', cls: 'gt-swap' },
  { cmd: 'bag', label: '가방', ic: 'bag', cls: 'gt-bag' },
];

/** Phone controls: a floating stick on the lower left, fire / wait / potion / target buttons on the lower right. */
export class GridTouch {
  readonly el = document.createElement('div');
  private readonly base = document.createElement('div');
  private readonly knob = document.createElement('div');
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;

  constructor(private readonly onCmd: (c: GridCmd) => void) {
    this.el.className = 'gt';
    const pad = document.createElement('div');
    pad.className = 'gt-pad';
    this.base.className = 'gt-stick';
    this.knob.className = 'gt-knob';
    this.base.appendChild(this.knob);
    this.base.hidden = true;
    const box = document.createElement('div');
    box.className = 'gt-buttons';
    for (const b of BUTTONS) {
      const el = document.createElement('div');
      el.className = `gt-btn ${b.cls}`;
      el.dataset.testid = `grid-${b.cmd}`;
      el.innerHTML = `<span class="gt-ic">${icon(b.ic)}</span>${b.label ? `<em>${b.label}</em>` : ''}<small></small>`;
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.onCmd(b.cmd); });
      box.appendChild(el);
    }
    this.el.append(pad, this.base, box);
    pad.addEventListener('pointerdown', (e) => {
      if (this.stick) return;
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      try { pad.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      this.draw();
    });
    const move = (e: PointerEvent) => { if (this.stick?.id === e.pointerId) { this.stick.x = e.clientX; this.stick.y = e.clientY; this.draw(); } };
    const up = (e: PointerEvent) => { if (this.stick?.id === e.pointerId) { this.stick = null; this.draw(); } };
    pad.addEventListener('pointermove', move);
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
  }

  /** A pinch took over. */
  releaseStick(): void {
    this.stick = null;
    this.draw();
  }

  /** Stick vector, length ≤ 1 (screen axes), or null when untouched. */
  vector(): { x: number; y: number } | null {
    if (!this.stick) return null;
    const dx = (this.stick.x - this.stick.ox) / RADIUS;
    const dy = (this.stick.y - this.stick.oy) / RADIUS;
    const l = Math.hypot(dx, dy);
    return l > 1 ? { x: dx / l, y: dy / l } : { x: dx, y: dy };
  }

  private draw(): void {
    this.base.hidden = !this.stick;
    if (!this.stick) return;
    const v = this.vector()!;
    this.base.style.left = `${this.stick.ox}px`;
    this.base.style.top = `${this.stick.oy}px`;
    this.knob.style.transform = `translate(${v.x * RADIUS}px, ${v.y * RADIUS}px)`;
  }

  /** Fire button: the weapon in hand, what it will do, and the hit chance or state. */
  setFire(group: WeaponGroup | undefined, label: string, sub: string): void {
    const f = this.el.querySelector('.gt-fire')!;
    const key = `${group}|${label}|${sub}`;
    if (f.getAttribute('data-k') === key) return;
    f.setAttribute('data-k', key);
    f.querySelector('.gt-ic')!.innerHTML = weaponIcon(group);
    f.querySelector('em')!.textContent = label;
    f.querySelector('small')!.textContent = sub;
  }

  setPotions(n: number): void {
    const p = this.el.querySelector('.gt-potion small')!;
    if (p.textContent !== String(n)) p.textContent = String(n);
    this.el.querySelector('.gt-potion')!.classList.toggle('empty', n <= 0);
  }

  /** The swap button shows the weapon waiting in the other hand. */
  setSwap(group: WeaponGroup | undefined): void {
    const s = this.el.querySelector('.gt-swap small')!;
    const html = group ? weaponIcon(group) : '';
    if (s.innerHTML !== html) s.innerHTML = html;
  }

  dispose(): void {
    this.el.remove();
  }
}
