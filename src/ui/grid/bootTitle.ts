import type { Screen } from '../../app/router';
import '../styles/bootTitle.css';

export interface BootAsset { id: string; name: string; load: () => Promise<unknown> }
export interface BootTitleApi { hasRun(): boolean; start(): void; resume(): void; assets: BootAsset[] }

/** fixed boot lines before the asset checks (the ship waking a clone) */
const LINES: [string, string][] = [['R-7 비상 전원', '가동'], ['복제 포드', '정상'], ['기억 이식', '손상 37%']];
const TYPE_MS = 14;
const COLUMN = 24;
/** a Hangul syllable takes two cells of the monospaced font */
const cells = (s: string): number => [...s].reduce((n, ch) => n + (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(ch) ? 2 : 1), 0);
const dots = (k: string): string => ` ${'.'.repeat(Math.max(2, COLUMN - cells(k)))} `;

/** The title is the ship's boot log: it checks (loads) the assets while it types, then offers the menu. */
export class BootTitle implements Screen {
  private readonly el = document.createElement('div');
  private readonly log = document.createElement('div');
  private readonly menu = document.createElement('nav');
  private readonly bar = document.createElement('div');
  private items: { id: 'resume' | 'start'; label: string }[] = [];
  private sel = 0;
  private loaded = 0;
  private ready!: Promise<void>;
  private skip = false;
  private leaving = false;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private readonly api: BootTitleApi) {}

  mount(root: HTMLElement): void {
    this.el.className = 'boot';
    this.el.dataset.testid = 'boot-title';
    this.el.innerHTML = '<div class="boot-tube"><h1 class="boot-logo">PROJ_R</h1><p class="boot-sub">차원선 R-7</p></div>';
    const tube = this.el.firstElementChild!;
    this.log.className = 'boot-log';
    this.bar.className = 'boot-bar';
    this.menu.className = 'boot-menu';
    this.menu.hidden = true;
    tube.append(this.log, this.bar, this.menu);
    this.items = [...(this.api.hasRun() ? [{ id: 'resume' as const, label: '이어하기' }] : []), { id: 'start' as const, label: '출격' }];
    this.el.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-item]');
      if (b) this.choose(Number(b.dataset.item));
      else this.skip = true;
    });
    window.addEventListener('keydown', this.onKey);
    root.appendChild(this.el);
    this.drawBar();
    // loading starts at once; the log only shows it
    const loads = this.api.assets.map((a) => a.load().then(() => { this.loaded++; this.drawBar(); }));
    this.ready = Promise.all(loads).then(() => undefined);
    void this.boot(loads);
  }

  unmount(): void {
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }

  private drawBar(): void {
    const n = this.api.assets.length, cells = 16, on = Math.round((this.loaded / n) * cells);
    this.bar.textContent = `[${'■'.repeat(on)}${'□'.repeat(cells - on)}] ${this.loaded}/${n}`;
    this.bar.classList.toggle('done', this.loaded === n);
  }

  private line(): { row: HTMLElement; end: HTMLElement } {
    const row = document.createElement('div');
    row.className = 'boot-row';
    row.innerHTML = '<span class="k"></span><span class="d"></span><span class="v"></span>';
    this.log.append(row);
    return { row, end: row.querySelector<HTMLElement>('.v')! };
  }

  private async type(el: HTMLElement, text: string): Promise<void> {
    const quick = this.skip || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quick) { el.textContent = text; return; }
    for (let i = 1; i <= text.length; i++) {
      if (this.skip) { el.textContent = text; return; }
      el.textContent = text.slice(0, i);
      await new Promise((r) => setTimeout(r, TYPE_MS));
    }
  }

  private async boot(loads: Promise<void>[]): Promise<void> {
    for (const [k, v] of LINES) {
      const { row, end } = this.line();
      await this.type(row.querySelector<HTMLElement>('.k')!, k);
      row.querySelector<HTMLElement>('.d')!.textContent = dots(k);
      end.textContent = v;
      if (v.startsWith('손상')) end.classList.add('warn');
    }
    this.api.assets.forEach((a, i) => {
      const { row, end } = this.line();
      row.querySelector<HTMLElement>('.k')!.textContent = a.name;
      row.querySelector<HTMLElement>('.d')!.textContent = dots(a.name);
      end.textContent = '…';
      end.classList.add('wait');
      loads[i]!.then(() => { end.textContent = 'OK'; end.classList.remove('wait'); }, () => { end.textContent = 'ERR'; end.className = 'v err'; });
    });
    this.showMenu();
  }

  private showMenu(): void {
    this.menu.hidden = false;
    this.menu.innerHTML = this.items.map((it, i) => `<button type="button" class="boot-item${i === this.sel ? ' on' : ''}" data-item="${i}" data-testid="${it.id === 'start' ? 'to-grid' : 'continue-grid'}">${it.label}</button>`).join('');
  }

  private key(e: KeyboardEvent): void {
    if (this.menu.hidden) { this.skip = true; return; }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'ArrowUp' || e.key === 'w') {
      this.sel = (this.sel + (e.key === 'ArrowUp' || e.key === 'w' ? this.items.length - 1 : 1)) % this.items.length;
      this.showMenu();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.choose(this.sel);
    }
  }

  private choose(i: number): void {
    const it = this.items[i];
    if (!it || this.leaving) return;
    this.leaving = true;
    this.sel = i;
    this.showMenu();
    this.menu.querySelector(`[data-item="${i}"]`)?.classList.add('go');
    // the tube switches off once the assets are in, then the game takes over
    void this.ready.catch(() => undefined).then(() => {
      this.el.classList.add('off');
      setTimeout(() => (it.id === 'resume' ? this.api.resume() : this.api.start()), 320);
    });
  }
}
