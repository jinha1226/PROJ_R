export type NumberKind = 'dmg' | 'crit' | 'heal' | 'miss' | 'combo' | 'ally-hurt';

const POOL = 60;

/** Pooled floating numbers/labels. */
export class DamageNumbers {
  readonly el = document.createElement('div');
  private readonly pool: HTMLDivElement[] = [];
  private next = 0;

  constructor(parent: HTMLElement) {
    this.el.className = 'dmg-layer';
    parent.appendChild(this.el);
    for (let i = 0; i < POOL; i++) {
      const d = document.createElement('div');
      d.style.display = 'none';
      this.el.appendChild(d);
      this.pool.push(d);
    }
  }

  show(text: string, kind: NumberKind, left: number, top: number): void {
    const d = this.pool[this.next]!;
    this.next = (this.next + 1) % POOL;
    d.className = '';
    void d.offsetWidth;
    d.className = `dmg ${kind === 'dmg' ? '' : kind}`;
    d.textContent = text;
    d.style.left = `${left + (Math.random() - 0.5) * 18}px`;
    d.style.top = `${top}px`;
    d.style.display = 'block';
  }

  dispose(): void {
    this.el.remove();
  }
}
