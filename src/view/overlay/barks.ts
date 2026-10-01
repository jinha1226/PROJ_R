import { BARKS } from '../../ui/i18n/barks';

const LIFE = 2.2;
const STACK_PX = 26;

interface Bubble {
  unitId: string;
  el: HTMLDivElement;
  life: number;
}

/** Speech bubbles above units; picks a random line per key (presentation only). */
export class BarkLayer {
  readonly el = document.createElement('div');
  private readonly bubbles: Bubble[] = [];

  constructor(parent: HTMLElement) {
    this.el.className = 'bark-layer';
    parent.appendChild(this.el);
  }

  say(unitId: string, key: string): void {
    const lines = BARKS[key];
    if (!lines?.length) return;
    for (const b of this.bubbles) if (b.unitId === unitId) b.life = Math.min(b.life, 0.3);
    const el = document.createElement('div');
    el.className = 'bark';
    el.textContent = lines[Math.floor(Math.random() * lines.length)]!;
    this.el.appendChild(el);
    this.bubbles.push({ unitId, el, life: LIFE });
  }

  update(dt: number, screenOf: (id: string) => { left: number; top: number } | undefined): void {
    const stacks = new Map<string, number>();
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!;
      b.life -= dt;
      const p = screenOf(b.unitId);
      if (b.life <= 0 || !p) {
        b.el.remove();
        this.bubbles.splice(i, 1);
        continue;
      }
      const n = stacks.get(b.unitId) ?? 0;
      stacks.set(b.unitId, n + 1);
      b.el.style.left = `${p.left}px`;
      b.el.style.top = `${p.top - n * STACK_PX}px`;
      b.el.style.opacity = String(Math.min(1, b.life / 0.3));
    }
  }

  dispose(): void {
    this.el.remove();
    this.bubbles.length = 0;
  }
}
