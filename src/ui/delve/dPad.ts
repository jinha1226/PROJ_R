import type { PadActions } from '../overworld/touchPad';

/** `?dpad`: the dungeon steered with a pad of keys instead of the stick (to try beside it; the stick stays the default). */
export const DPAD = { on: typeof location !== 'undefined' && new URLSearchParams(location.search).has('dpad') };

/** a held key steps again after this long, then this often (real seconds) */
const FIRST = 0.26;
const REPEAT = 0.12;
/** the turn of each key's arrow (degrees from up); the middle key is wait */
const TURN = [315, 0, 45, 270, null, 90, 225, 180, 135];
const arrow = (deg: number) => `<svg viewBox="0 0 16 16" width="18" height="18" style="transform:rotate(${deg}deg)" aria-hidden="true"><path fill="currentColor" d="M8 2l5.5 6.5H10V14H6V8.5H2.5z"/></svg>`;

/**
 * An upright phone, the dungeon: nine keys bottom left — eight ways and, in the middle, wait. A press is one step (into a foe:
 * a blow); a key held keeps stepping, and a thumb slid onto another key turns that way. A held key lets go by itself the
 * moment a fight begins, so nobody runs on into danger with a thumb down. Bottom right: the target key, and one key that is
 * explore while nothing is in sight and attack while something is.
 */
export class DPad {
  readonly el = document.createElement('div');
  readonly zone: HTMLElement;
  private readonly main: HTMLElement;
  private readonly keys: HTMLElement[];
  private held: number | null = null;
  private timer = 0;
  private fighting = false;
  private idle = true;

  constructor(private readonly a: PadActions) {
    document.documentElement.classList.add('pad-keys');
    this.el.className = 'tp dp';
    this.el.innerHTML = `<div class="dp-grid">${TURN.map((t, i) => `<div data-i="${i}">${t === null ? '대기' : arrow(t)}</div>`).join('')}</div>
      <div class="dp-keys"><button type="button" data-a="next" class="none">대상</button><button type="button" data-a="main">탐험</button></div>`;
    this.zone = this.el.querySelector('.dp-grid')!;
    this.main = this.el.querySelector('[data-a="main"]')!;
    this.keys = [...this.zone.children] as HTMLElement[];
    const keyAt = (e: PointerEvent): number | null => {
      const r = this.zone.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * 3), y = Math.floor(((e.clientY - r.top) / r.height) * 3);
      return x < 0 || x > 2 || y < 0 || y > 2 ? null : y * 3 + x;
    };
    const press = (i: number | null) => {
      if (i === this.held) return;
      this.light(i);
      this.held = i;
      if (i === null) return;
      this.timer = FIRST;
      this.act(i);
    };
    this.zone.addEventListener('pointerdown', (e) => { e.preventDefault(); this.zone.setPointerCapture(e.pointerId); press(keyAt(e)); });
    this.zone.addEventListener('pointermove', (e) => { if (this.held !== null && this.zone.hasPointerCapture(e.pointerId)) press(keyAt(e)); });
    for (const end of ['pointerup', 'pointercancel'] as const) this.zone.addEventListener(end, () => this.cancel());
    this.el.querySelector('.dp-keys')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (k === 'next') a.next?.();
      if (k === 'main') { if (!this.idle) a.attack(); else if (a.explore) a.explore(); else a.wait(); }
    });
  }

  private light(i: number | null): void { this.keys.forEach((k, n) => k.classList.toggle('on', n === i)); }

  private act(i: number): void {
    if (i === 4) this.a.wait(); else this.a.dir((i % 3) - 1, Math.floor(i / 3) - 1);
  }

  /** lets go of the held key */
  cancel(): void { this.held = null; this.light(null); }

  /** a held key keeps stepping (never the wait key); the keys on the right follow what is in sight */
  update(dt: number, fighting = false, target = false): void {
    if (target === this.idle) {
      this.idle = !target;
      this.main.textContent = target ? '공격' : '탐험';
      this.main.classList.toggle('atk', target);
      this.el.querySelector('[data-a="next"]')!.classList.toggle('none', !target);
    }
    // a fight has begun under a held key: it lets go (the thumb presses again to go on)
    if (fighting && !this.fighting && this.held !== null) this.cancel();
    this.fighting = fighting;
    if (this.held === null || this.held === 4) return;
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = REPEAT; this.act(this.held); }
  }
}
