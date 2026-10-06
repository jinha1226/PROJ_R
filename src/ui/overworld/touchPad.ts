export interface PadActions { dir(dx: number, dy: number): void; attack(): void; wait(): void; bag(): void; stat(): void; tap?(x: number, y: number): void }

/** how often a held stick asks for another step (real seconds) */
const REPEAT = 0.2;
/** a touch that drifts less than this is a tap on the field, not a push of the stick */
const DEADZONE = 14;

/**
 * Touch screens: a stick that is not there until a thumb lands in the lower-left zone, then appears under it (eight ways;
 * held, it keeps stepping; a touch that never moves is passed on as a tap on the field) — and four big buttons bottom right:
 * attack the nearest foe, wait (pass the turn, or stop), bag, status.
 */
export class TouchPad {
  readonly el = document.createElement('div');
  private readonly zone: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly base: HTMLElement;
  private dirNow: { x: number; y: number } | null = null;
  private timer = 0;
  private origin: { x: number; y: number } | null = null;
  private moved = false;

  constructor(private readonly a: PadActions) {
    this.el.className = 'tp';
    this.el.innerHTML = `<div class="tp-zone"><div class="tp-base"><div class="tp-knob"></div></div></div>
      <div class="tp-btns"><button type="button" data-a="attack">공격</button><button type="button" data-a="wait">대기</button><button type="button" data-a="bag">가방</button><button type="button" data-a="stat">상태</button></div>`;
    this.zone = this.el.querySelector('.tp-zone')!;
    this.base = this.el.querySelector('.tp-base')!;
    this.knob = this.el.querySelector('.tp-knob')!;
    const move = (e: PointerEvent) => {
      if (!this.origin) return;
      const dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y, len = Math.hypot(dx, dy), max = this.base.offsetWidth / 2 || 66;
      if (len > DEADZONE) this.moved = true;
      const k = Math.min(1, len / max);
      this.knob.style.transform = `translate(${(dx / (len || 1)) * k * max * 0.6}px, ${(dy / (len || 1)) * k * max * 0.6}px)`;
      if (len < Math.max(DEADZONE, max * 0.3)) { this.dirNow = null; return; }
      // eight ways
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
      const d = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }][(a + 8) % 8]!;
      const was = this.dirNow;
      this.dirNow = d;
      if (!was || was.x !== d.x || was.y !== d.y) { this.timer = REPEAT; this.a.dir(d.x, d.y); }
    };
    const end = (e: PointerEvent) => {
      if (this.origin && !this.moved) this.a.tap?.(e.clientX, e.clientY);
      this.origin = null; this.dirNow = null; this.knob.style.transform = '';
      this.zone.classList.remove('on');
    };
    this.zone.addEventListener('pointerdown', (e) => {
      this.zone.setPointerCapture(e.pointerId);
      const r = this.zone.getBoundingClientRect();
      this.origin = { x: e.clientX, y: e.clientY };
      this.moved = false;
      this.base.style.left = `${e.clientX - r.left}px`;
      this.base.style.top = `${e.clientY - r.top}px`;
      this.zone.classList.add('on');
    });
    this.zone.addEventListener('pointermove', (e) => { if (this.zone.hasPointerCapture(e.pointerId)) move(e); });
    this.zone.addEventListener('pointerup', end);
    this.zone.addEventListener('pointercancel', (e) => { this.moved = true; end(e); });
    this.zone.style.touchAction = 'none';
    this.el.querySelector('.tp-btns')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (k === 'attack') a.attack();
      if (k === 'wait') a.wait();
      if (k === 'bag') a.bag();
      if (k === 'stat') a.stat();
    });
  }

  /** a held stick keeps stepping */
  update(dt: number): void {
    if (!this.dirNow) return;
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = REPEAT; this.a.dir(this.dirNow.x, this.dirNow.y); }
  }
}
