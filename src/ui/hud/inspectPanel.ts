import type { TagId } from '../../data/types';
import type { UnitSetup, UnitSnap } from '../../sim/battle/types';
import { t } from '../i18n/ko';

const roleName = (u: UnitSetup): string => (u.team === 'ally' ? t(`class.${u.defId}`) : t(`enemy.${u.defId}`));

/** Unit chips along the top plus a side panel describing the selected unit's state and intent. */
export class InspectPanel {
  readonly chips = document.createElement('div');
  readonly panel = document.createElement('div');
  private selected: string | null = null;

  constructor(parent: HTMLElement, private readonly units: () => UnitSetup[], private readonly nameOf: (u: UnitSetup) => string) {
    this.chips.className = 'hud-chips';
    this.panel.className = 'hud-inspect';
    this.panel.dataset.testid = 'inspect';
    this.panel.hidden = true;
    parent.append(this.chips, this.panel);
    this.refreshChips();
  }

  refreshChips(): void {
    this.chips.innerHTML = '';
    for (const u of this.units()) {
      const b = document.createElement('button');
      b.className = `chip ${u.team}`;
      b.dataset.testid = `unit-chip-${u.id}`;
      b.style.borderColor = u.team === 'ally' ? u.color : '';
      b.textContent = this.nameOf(u);
      b.addEventListener('click', () => this.select(u.id));
      this.chips.appendChild(b);
    }
  }

  get selectedId(): string | null {
    return this.selected;
  }

  select(id: string | null): void {
    this.selected = this.selected === id ? null : id;
    this.panel.hidden = !this.selected;
  }

  update(snap: (id: string) => UnitSnap | undefined): void {
    if (!this.selected) return;
    const u = this.units().find((x) => x.id === this.selected);
    const s = snap(this.selected);
    if (!u || !s) return;
    const state = !s.alive ? '사망' : s.downed ? `쓰러짐 (생명선 ${Math.ceil(s.lifeline)})` : `${Math.ceil(s.hp)} / ${s.maxHp}`;
    const intent = s.intent;
    const reasons = (intent?.detail ?? []).map((r) => `<span class="reason-chip">${t(`reason.${r}`)}</span>`).join('');
    const tags = [...new Set(s.tags)].map((tg) => t(`tag.${tg as TagId}`)).join(', ') || '없음';
    const tactics = u.tactics.map((x) => t(`tactic.${x}`)).join(', ') || '없음';
    const what = intent?.skillId ? ` · ${t(`skill.${intent.skillId}`)}` : '';
    this.panel.innerHTML = `
      <div class="insp-name" style="color:${u.team === 'ally' ? u.color : '#ffb4a8'}">${this.nameOf(u)}</div>
      <div class="insp-sub">${roleName(u)}</div>
      <div class="insp-row"><b>HP</b> ${state}</div>
      <div class="insp-row"><b>기세</b> ${Math.floor(s.momentum)} / 100</div>
      <div class="insp-row"><b>상태</b> ${tags}</div>
      <div class="insp-row"><b>전술</b> ${tactics}</div>
      <div class="insp-intent">${s.alive && !s.downed && intent ? `${t(`reason.${intent.reason}`)}${what}` : '—'}</div>
      <div class="insp-reasons">${reasons}</div>`;
  }

  dispose(): void {
    this.chips.remove();
    this.panel.remove();
  }
}
