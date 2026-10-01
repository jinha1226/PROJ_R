import type { Screen } from '../../app/router';
import { stageFor } from '../../sim/roster/companyBattle';
import type { Roster } from '../../sim/roster/types';
import { renderSheet, type SheetTab } from '../company/characterSheet';
import { renderCard } from '../company/rosterCards';
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
  unequip(mercId: string, slot: 'weapon' | 'armor' | 'trinket'): void;
  nextLevelUp(host: HTMLElement): Promise<void>;
  newCompany(): void;
  exit(): void;
}

const ENEMIES: [string, string][] = [['tutorial', '해골 졸개 무리'], ['bandits', '산적단'], ['skeletons', '해골 부대'], ['ambush', '산적 매복'], ['boss', '보스: 잿빛 기사']];

export class CompanyScreen implements Screen {
  private el = document.createElement('div');
  private open: { id: string; tab: SheetTab } | null = null;

  constructor(private readonly api: CompanyApi) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen company';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('change', (e) => this.onChange(e));
    this.render();
  }

  private render(): void {
    const r = this.api.roster();
    const deployed = new Set(this.api.deployed());
    const pending = r.mercs.filter((m) => m.pendingLevelUps > 0).length;
    const wiped = r.mercs.length === 0;
    const sheetMerc = this.open ? r.mercs.find((m) => m.id === this.open!.id) : undefined;
    this.el.innerHTML = `
      <header class="company-head"><div><h1>용병단</h1><span class="muted">전투 ${r.battles} · 다음 전투 단계 ${stageFor(r.battles)} · 보관 장비 ${r.inventory.length}</span></div>
        <button class="btn" data-act="exit">샌드박스로</button></header>
      ${wiped ? `<div class="panel wipe" data-testid="wipe"><h2>용병단이 전멸했다</h2><button class="btn primary" data-act="new">새 용병단</button></div>` : ''}
      <div class="cards">${r.mercs.map((m) => renderCard(m, deployed.has(m.id))).join('')}</div>
      <div class="company-actions">
        ${pending ? `<button class="btn primary" data-act="levelup" data-testid="levelup-next">레벨업 진행 (${pending})</button>` : ''}
        <select data-testid="enemy-select">${ENEMIES.map(([k, l]) => `<option value="${k}" ${k === this.api.enemy() ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn primary" data-act="fight" data-testid="fight" ${deployed.size === 0 ? 'disabled' : ''}>출전 (${deployed.size}/5)</button>
      </div>
      ${r.memorial.length ? `<details class="memorial"><summary>추모 (${r.memorial.length})</summary><ul>${r.memorial.map((m) => `<li><b>${displayName(m)}</b> Lv${m.level} — ${chronicleText(m.chronicle.at(-1)!, r)}</li>`).join('')}</ul></details>` : ''}
      ${sheetMerc ? `<div class="sheet-wrap">${renderSheet(sheetMerc, r, this.open!.tab)}</div>` : ''}`;
  }

  private onChange(e: Event): void {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t instanceof HTMLInputElement && t.dataset.deploy) this.api.toggleDeploy(t.dataset.deploy);
    if (t instanceof HTMLSelectElement && t.dataset.testid === 'enemy-select') this.api.setEnemy(t.value);
    this.render();
  }

  private onClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.closest('label.deploy')) return;
    const btn = target.closest<HTMLElement>('[data-act],[data-tab]');
    const card = target.closest<HTMLElement>('.merc-card');
    const sheet = this.open;
    if (btn?.dataset.tab && sheet) { this.open = { ...sheet, tab: btn.dataset.tab as SheetTab }; return this.render(); }
    switch (btn?.dataset.act) {
      case 'exit': return this.api.exit();
      case 'new': return this.api.newCompany();
      case 'fight': return this.api.fight();
      case 'close': this.open = null; return this.render();
      case 'levelup': void this.api.nextLevelUp(this.el).then(() => this.render()); return;
      case 'equip': if (sheet && btn.dataset.item) this.api.equip(sheet.id, btn.dataset.item); return this.render();
      case 'unequip': if (sheet && btn.dataset.slot) this.api.unequip(sheet.id, btn.dataset.slot as 'weapon'); return this.render();
    }
    if (card?.dataset.merc) { this.open = { id: card.dataset.merc, tab: this.open?.tab ?? 'stats' }; this.render(); }
  }

  unmount(): void {
    this.el.remove();
  }
}
