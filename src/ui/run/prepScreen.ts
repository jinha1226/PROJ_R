import type { Screen } from '../../app/router';
import { t } from '../i18n/ko';
import type { RunState, Slot } from '../../sim/run/types';
import { RosterPanel, type RosterPanelApi } from '../company/rosterPanel';
import { adjacencyPreview } from './adjacency';
import { FormationGrid } from './formationGrid';
import { runHud } from './runHud';

export interface PrepApi extends Omit<RosterPanelApi, 'roster' | 'changed'> {
  run(): RunState;
  enemies: { enemyId: string }[];
  title: string;
  start(formation: Record<string, Slot>): void;
}

/** Battle preparation: formation, relationship preview, enemy preview, and roster management. */
export class PrepScreen implements Screen {
  private el = document.createElement('div');
  private grid: FormationGrid;
  private panel: RosterPanel;
  private preview = document.createElement('div');

  constructor(private readonly api: PrepApi, initial: Record<string, Slot>) {
    const mercs = api.run().roster.mercs.filter((m) => m.alive);
    this.grid = new FormationGrid(mercs, initial, () => this.refresh());
    this.panel = new RosterPanel({ ...api, roster: () => api.run().roster, changed: () => this.refresh() });
  }

  mount(root: HTMLElement): void {
    const run = this.api.run();
    const counts = new Map<string, number>();
    for (const e of this.api.enemies) counts.set(e.enemyId, (counts.get(e.enemyId) ?? 0) + 1);
    const foes = [...counts].map(([id, n]) => `<li>${t(`enemy.${id}`)} × ${n}</li>`).join('');
    this.el.className = 'screen node-screen prep';
    this.el.innerHTML = `${runHud(run, '', false)}
      <div class="panel node-panel wide"><h2>${this.api.title}</h2>
        <div class="prep-body"><div class="prep-left"></div>
          <div class="prep-right"><h4>적</h4><ul class="foes">${foes}</ul><h4>관계 효과</h4><div class="adj"></div></div></div>
        <div class="prep-actions"><button class="btn" data-act="manage" data-testid="manage">용병단 관리 (장비·기술·전술)</button>
          <button class="btn primary" data-act="start" data-testid="start-node-battle">출전</button></div>
        <div class="prep-manage" hidden></div></div>`;
    this.el.querySelector('.prep-left')!.appendChild(this.grid.el);
    this.el.querySelector('.adj')!.appendChild(this.preview);
    this.el.querySelector('.prep-manage')!.appendChild(this.panel.el);
    this.el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'start' && Object.keys(this.grid.value).length) this.api.start(this.grid.value);
      if (act === 'manage') {
        const m = this.el.querySelector<HTMLElement>('.prep-manage')!;
        m.hidden = !m.hidden;
        this.panel.render();
      }
    });
    root.appendChild(this.el);
    this.grid.render();
    this.refresh();
  }

  private refresh(): void {
    const lines = adjacencyPreview(this.api.run().roster, this.grid.value);
    this.preview.innerHTML = lines.length ? `<ul class="adj-list">${lines.map((l) => `<li class="adj-${l.kind}">${l.text}</li>`).join('')}</ul>` : '<p class="muted">인접한 관계가 없다.</p>';
    const start = this.el.querySelector<HTMLButtonElement>('[data-act="start"]');
    if (start) start.disabled = Object.keys(this.grid.value).length === 0;
  }

  unmount(): void {
    this.el.remove();
  }
}
