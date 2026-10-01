import type { Screen } from '../../app/router';
import type { ItemSlot, TacticId } from '../../data/types';
import { stageFor } from '../../sim/roster/companyBattle';
import type { Roster } from '../../sim/roster/types';
import { RosterPanel } from '../company/rosterPanel';
import { chronicleText, displayName } from '../company/text';
import '../styles/company.css';

export interface CompanyApi {
  roster(): Roster;
  deployed(): string[];
  toggleDeploy(id: string): void;
  enemy(): string;
  setEnemy(key: string): void;
  fight(): void;
  equip(mercId: string, itemId: string): void;
  unequip(mercId: string, slot: ItemSlot): void;
  setTactic(mercId: string, slot: number, tactic: TacticId): void;
  nextLevelUp(host: HTMLElement): Promise<void>;
  newCompany(): void;
  exit(): void;
}

const ENEMIES: [string, string][] = [['tutorial', '해골 졸개 무리'], ['bandits', '산적단'], ['skeletons', '해골 부대'], ['ambush', '산적 매복'], ['boss', '보스: 잿빛 기사']];

export class CompanyScreen implements Screen {
  private el = document.createElement('div');
  private top = document.createElement('div');
  private bottom = document.createElement('div');
  private panel: RosterPanel;

  constructor(private readonly api: CompanyApi) {
    this.panel = new RosterPanel({ ...api, changed: () => this.renderChrome() });
  }

  mount(root: HTMLElement): void {
    this.el.className = 'screen company';
    this.el.append(this.top, this.panel.el, this.bottom);
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.bottom.addEventListener('change', (e) => {
      const t = e.target as HTMLSelectElement;
      if (t.dataset.testid === 'enemy-select') this.api.setEnemy(t.value);
    });
    this.panel.render();
    this.renderChrome();
  }

  private renderChrome(): void {
    const r = this.api.roster();
    const deployed = this.api.deployed().length;
    const pending = r.mercs.filter((m) => m.pendingLevelUps > 0).length;
    this.top.innerHTML = `<header class="company-head"><div><h1>용병단</h1><span class="muted">전투 ${r.battles} · 다음 전투 단계 ${stageFor(r.battles)} · 보관 장비 ${r.inventory.length}</span></div>
      <button class="btn" data-act="exit">샌드박스로</button></header>
      ${r.mercs.length === 0 ? '<div class="panel wipe" data-testid="wipe"><h2>용병단이 전멸했다</h2><button class="btn primary" data-act="new">새 용병단</button></div>' : ''}`;
    this.bottom.innerHTML = `<div class="company-actions">
        ${pending ? `<button class="btn primary" data-act="levelup" data-testid="levelup-next">레벨업 진행 (${pending})</button>` : ''}
        <select data-testid="enemy-select">${ENEMIES.map(([k, l]) => `<option value="${k}" ${k === this.api.enemy() ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn primary" data-act="fight" data-testid="fight" ${deployed === 0 ? 'disabled' : ''}>출전 (${deployed}/5)</button></div>
      ${r.memorial.length ? `<details class="memorial"><summary>추모 (${r.memorial.length})</summary><ul>${r.memorial.map((m) => `<li><b>${displayName(m)}</b> Lv${m.level} — ${chronicleText(m.chronicle.at(-1)!, r)}</li>`).join('')}</ul></details>` : ''}`;
  }

  private onClick(e: Event): void {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'exit') this.api.exit();
    else if (act === 'new') this.api.newCompany();
    else if (act === 'fight') this.api.fight();
    else if (act === 'levelup') void this.api.nextLevelUp(this.el).then(() => { this.panel.render(); this.renderChrome(); });
  }

  unmount(): void {
    this.el.remove();
  }
}
