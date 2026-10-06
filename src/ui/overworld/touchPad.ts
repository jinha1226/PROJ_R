export interface PadActions { dir(dx: number, dy: number): void; attack(): void; wait(): void; bag(): void; stat(): void }

/** how often a held stick asks for another step (real seconds) */
const REPEAT = 0.2;

/**
 * Phones held upright: a stick bottom left (eight ways; held, it keeps stepping) and four big buttons bottom right —
 * attack the nearest foe, wait (pass the turn, or stop), bag, status.
 */
export class TouchPad {
  readonly el = document.createElement('div');
  private readonly knob: HTMLElement;
  private readonly base: HTMLElement;
  private dirNow: { x: number; y: number } | null = null;
  private timer = 0;

  constructor(private readonly a: PadActions) {
    this.el.className = 'tp';
    this.el.innerHTML = `<div class="tp-pad"><div class="tp-base"><div class="tp-knob"></div></div></div>
      <div class="tp-btns"><button type="button" data-a="attack">공격</button><button type="button" data-a="wait">대기</button><button type="button" data-a="bag">가방</button><button type="button" data-a="stat">상태</button></div>`;
    this.base = this.el.querySelector('.tp-base')!;
    this.knob = this.el.querySelector('.tp-knob')!;
    const move = (e: PointerEvent) => {
      const r = this.base.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy, len = Math.hypot(dx, dy), max = r.width / 2;
      const k = Math.min(1, len / max);
      this.knob.style.transform = `translate(${(dx / (len || 1)) * k * max * 0.6}px, ${(dy / (len || 1)) * k * max * 0.6}px)`;
      if (len < max * 0.3) { this.dirNow = null; return; }
      // eight ways
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
      const d = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }][(a + 8) % 8]!;
      const was = this.dirNow;
      this.dirNow = d;
      if (!was || was.x !== d.x || was.y !== d.y) { this.timer = REPEAT; this.a.dir(d.x, d.y); }
    };
    const end = () => { this.dirNow = null; this.knob.style.transform = ''; };
    this.base.addEventListener('pointerdown', (e) => { this.base.setPointerCapture(e.pointerId); move(e); });
    this.base.addEventListener('pointermove', (e) => { if (this.base.hasPointerCapture(e.pointerId)) move(e); });
    this.base.addEventListener('pointerup', end);
    this.base.addEventListener('pointercancel', end);
    this.base.style.touchAction = 'none';
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
