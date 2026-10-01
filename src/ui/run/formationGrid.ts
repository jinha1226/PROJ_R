import type { Mercenary } from '../../sim/roster/types';
import type { Slot } from '../../sim/run/types';
import { t } from '../i18n/ko';

export const MAX_DEPLOY = 5;
const key = (s: Slot) => `${s.col},${s.row}`;

/** Formation editing state: click-to-place and drag-and-drop over a 3×4 grid plus a bench. */
export class FormationGrid {
  readonly el = document.createElement('div');
  private selected: string | null = null;

  constructor(private readonly mercs: Mercenary[], private formation: Record<string, Slot>, private readonly onChange: (f: Record<string, Slot>) => void) {
    this.el.className = 'formation';
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('dragstart', (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-merc]')?.dataset.merc;
      if (id) e.dataTransfer?.setData('text/plain', id);
    });
    this.el.addEventListener('dragover', (e) => e.preventDefault());
    this.el.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/plain');
      const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
      if (!id) return;
      if (cell) this.place(id, this.parse(cell.dataset.cell!));
      else if ((e.target as HTMLElement).closest('.bench')) this.unplace(id);
    });
  }

  get value(): Record<string, Slot> {
    return this.formation;
  }

  private parse(c: string): Slot {
    const [col, row] = c.split(',').map(Number);
    return { col: col as Slot['col'], row: row as Slot['row'] };
  }

  private occupant(s: Slot): string | undefined {
    return Object.keys(this.formation).find((id) => key(this.formation[id]!) === key(s));
  }

  private place(id: string, s: Slot): void {
    const f = { ...this.formation };
    const other = this.occupant(s);
    const from = f[id];
    if (!from && !other && Object.keys(f).length >= MAX_DEPLOY) return;
    if (other && other !== id) { if (from) f[other] = from; else delete f[other]; }
    f[id] = s;
    this.commit(f);
  }

  private unplace(id: string): void {
    const f = { ...this.formation };
    delete f[id];
    this.commit(f);
  }

  private commit(f: Record<string, Slot>): void {
    this.formation = f;
    this.selected = null;
    this.onChange(f);
    this.render();
  }

  private onClick(e: Event): void {
    const t = e.target as HTMLElement;
    const chip = t.closest<HTMLElement>('[data-merc]');
    const cell = t.closest<HTMLElement>('[data-cell]');
    if (cell && this.selected) return this.place(this.selected, this.parse(cell.dataset.cell!));
    if (chip?.dataset.merc) {
      if (this.selected === chip.dataset.merc && this.formation[chip.dataset.merc]) return this.unplace(chip.dataset.merc);
      this.selected = chip.dataset.merc;
      return this.render();
    }
  }

  private chip(m: Mercenary): string {
    return `<div class="fchip ${this.selected === m.id ? 'sel' : ''} ${m.injury ? 'hurt' : ''}" draggable="true" data-merc="${m.id}" data-testid="chip-${m.id}" style="--c:${m.color}">
      <b>${m.name}</b><small>Lv${m.level} ${t(`class.${m.classId}`)}${m.injury ? ' · 부상' : ''}</small></div>`;
  }

  render(): void {
    const cells: string[] = [];
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 3; col++) {
        const s = { col, row } as Slot;
        const id = this.occupant(s);
        const m = id ? this.mercs.find((x) => x.id === id) : undefined;
        cells.push(`<div class="fcell" data-cell="${col},${row}" data-testid="cell-${col}-${row}">${m ? this.chip(m) : ''}</div>`);
      }
    const bench = this.mercs.filter((m) => !this.formation[m.id]);
    this.el.innerHTML = `<div class="fgrid-wrap"><div class="flabels"><span>후열</span><span>중열</span><span>전열 →</span></div>
      <div class="fgrid">${cells.join('')}</div></div>
      <div class="bench"><h4>대기 (${bench.length}) · 출전 ${Object.keys(this.formation).length}/${MAX_DEPLOY}</h4>${bench.map((m) => this.chip(m)).join('') || '<p class="muted">모두 배치됨</p>'}</div>
      <p class="muted fhelp">카드를 고른 뒤 칸을 누르거나 끌어다 놓으세요. 배치된 카드를 다시 누르면 대기로 돌아갑니다.</p>`;
  }
}
