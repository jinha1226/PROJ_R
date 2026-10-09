import type { Cell } from '../../sim/grid/types';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { BaseView } from '../../view/overworld/baseView';
import { MODULE_NAMES } from './basePanels';
import '../styles/baseHud.css';

/** What is written over the base's ground: each module's name (and that the workshop is still broken). */
export function baseLabels(p: WorldParty): { at: Cell; y: number; text: string; on: boolean; cls: string }[] {
  return (p.modules ?? []).map((m) => ({ at: { x: m.at.x + 0.5, y: m.at.y + 0.5 }, y: 2.1, text: `${MODULE_NAMES[m.id]}${m.broken ? ' · 고장' : ''}`, on: false, cls: m.broken ? ' mod off' : ' mod' }));
}

/** What the screen keeps for the base: the figures on its ground (modules, the dome) and the start-floor choice at the shaft. */
export class BaseTools {
  readonly view: BaseView;
  private readonly floors = document.createElement('div');
  private pickFloor: ((f: number) => void) | null = null;

  constructor(private readonly p: () => WorldParty) {
    this.view = new BaseView(import.meta.env.BASE_URL);
    this.floors.className = 'pip-win menu-win';
    this.floors.hidden = true;
    this.floors.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, f = t.closest<HTMLElement>('[data-floor]')?.dataset.floor;
      if (f || t === this.floors || t.closest('[data-close]')) { this.floors.hidden = true; if (f) this.pickFloor?.(Number(f)); }
    });
  }

  /** the floor chooser, for the screen to mount */
  get parts(): HTMLElement[] { return [this.floors]; }
  get choosing(): boolean { return !this.floors.hidden; }

  update(dt = 0): void { const p = this.p(); this.view.sync(p, dt); }

  /** At the shaft with deeper starts open: ask which floor to begin on. */
  chooseFloor(floors: number[], pick: (f: number) => void): void {
    this.pickFloor = pick;
    this.floors.innerHTML = `<div class="pip-frame menu-frame"><header><span class="pip-title">시작 층</span><button type="button" data-close>✕</button></header><div class="menu-body"><div class="menu-row">${floors.map((f) => `<button type="button" data-floor="${f}">지하 ${f}층</button>`).join('')}</div></div></div>`;
    this.floors.hidden = false;
  }
}
