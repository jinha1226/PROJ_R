import type { Screen } from '../../app/router';
import type { RunState } from '../../sim/run/types';
import { RosterPanel, type RosterPanelApi } from '../company/rosterPanel';
import { runHud } from './runHud';
import { renderRelationGraph } from './relationGraph';
import '../styles/company.css';

export interface RosterScreenApi extends Omit<RosterPanelApi, 'roster' | 'changed'> {
  run(): RunState;
  back(): void;
  nextLevelUp(host: HTMLElement): Promise<void>;
}

/** Company overview during a run: cards/sheets, relationship graph, pending level-ups. */
export class RosterScreen implements Screen {
  private el = document.createElement('div');
  private head = document.createElement('div');
  private graph = document.createElement('div');
  private panel: RosterPanel;

  constructor(private readonly api: RosterScreenApi) {
    this.panel = new RosterPanel({ ...api, roster: () => api.run().roster, changed: () => this.refresh() });
  }

  mount(root: HTMLElement): void {
    this.el.className = 'screen company run-roster';
    this.graph.className = 'panel graph-panel';
    this.el.append(this.head, this.panel.el, this.graph);
    this.el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'back') this.api.back();
      else if (act === 'levelup') void this.api.nextLevelUp(this.el).then(() => this.refresh());
    });
    root.appendChild(this.el);
    this.refresh();
  }

  private refresh(): void {
    const run = this.api.run();
    const pending = run.roster.mercs.filter((m) => m.pendingLevelUps > 0).length;
    this.head.innerHTML = runHud(run, `${pending ? `<button class="btn primary" data-act="levelup" data-testid="levelup-next">레벨업 진행 (${pending})</button>` : ''}
      <button class="btn" data-act="back" data-testid="back-to-map">돌아가기</button>`)
      .replace('data-act="roster"', 'data-act="noop" hidden').replace('data-act="quit"', 'data-act="noop" hidden');
    this.panel.render();
    renderRelationGraph(this.graph, run.roster);
  }

  unmount(): void {
    this.el.remove();
  }
}
