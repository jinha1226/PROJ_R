import type { Speed } from '../../view/playback/battlePlayer';
import { t } from '../i18n/ko';

export interface ControlsDeps {
  getSpeed(): Speed;
  setSpeed(s: Speed): void;
  retreat(): void;
}

/** Pause / speed / retreat buttons plus Space and 1/2/3 hotkeys. */
export class Controls {
  readonly el = document.createElement('div');
  private lastSpeed: Exclude<Speed, 0> = 1;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'Space') { e.preventDefault(); this.togglePause(); }
    if (e.key === '1') this.speed(1);
    if (e.key === '2') this.speed(2);
    if (e.key === '3') this.speed(4);
  };

  constructor(parent: HTMLElement, private readonly d: ControlsDeps) {
    this.el.className = 'hud-controls';
    this.el.innerHTML = `
      <button class="btn" data-testid="pause"></button>
      <button class="btn" data-testid="speed-1">1x</button>
      <button class="btn" data-testid="speed-2">2x</button>
      <button class="btn" data-testid="speed-4">4x</button>
      <button class="btn danger" data-testid="retreat">${t('ui.retreat')}</button>`;
    parent.appendChild(this.el);
    this.btn('pause').addEventListener('click', () => this.togglePause());
    for (const s of [1, 2, 4] as const) this.btn(`speed-${s}`).addEventListener('click', () => this.speed(s));
    this.btn('retreat').addEventListener('click', () => d.retreat());
    window.addEventListener('keydown', this.onKey);
    this.render();
  }

  private btn(id: string): HTMLButtonElement {
    return this.el.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;
  }

  private speed(s: Exclude<Speed, 0>): void {
    this.lastSpeed = s;
    this.d.setSpeed(s);
    this.render();
  }

  togglePause(): void {
    this.d.setSpeed(this.d.getSpeed() === 0 ? this.lastSpeed : 0);
    this.render();
  }

  private render(): void {
    const sp = this.d.getSpeed();
    this.btn('pause').textContent = sp === 0 ? `▶ ${t('ui.resume')}` : `❚❚ ${t('ui.pause')}`;
    for (const s of [1, 2, 4]) this.btn(`speed-${s}`).classList.toggle('active', sp === s);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }
}
