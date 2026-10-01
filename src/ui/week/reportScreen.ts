import type { Screen } from '../../app/router';
import type { RunState } from '../../sim/run/types';
import { iconBadge } from '../../view/overlay/icons';
import { itemLabel } from '../company/text';
import { t } from '../i18n/ko';

const KIND: Record<string, string> = { train: '훈련', rest: '휴식', explore: '탐험' };
const NOTE: Record<string, string> = {
  spar: '{a}와(과) {b}이(가) 대련 끝에 서로를 라이벌로 인정했다.', trainBond: '{a}와(과) {b}이(가) 함께 땀 흘리며 가까워졌다.',
  talk: '{a}와(과) {b}이(가) 밤새 이야기를 나눴다.', returned: '방 {rooms}곳을 둘러보고 무사히 돌아왔다.', retreated: '패퇴해 서둘러 물러났다.',
};

/** End-of-week summary: what happened, who grew, what was found. */
export class ReportScreen implements Screen {
  private el = document.createElement('div');

  constructor(private readonly run: RunState, private readonly next: () => void) {}

  mount(root: HTMLElement): void {
    const r = this.run.report!;
    const name = (id: string) => this.run.roster.mercs.find((m) => m.id === id)?.name ?? id;
    const xp = Object.entries(r.xp).map(([id, v]) => `<li><b>${name(id)}</b> <span class="xp">+${v} XP</span></li>`).join('');
    const notes = r.notes.map((n) => `<li>${(NOTE[n.key] ?? n.key).replace(/\{(\w+)\}/g, (_, k: string) => n.vars[k] ?? '')}</li>`).join('');
    const items = r.items.map((id) => { const l = itemLabel(id); return `<li class="item tier-${l.tier}"><b>${l.name}</b> <small>${t(`tier.${l.tier}`)}</small></li>`; }).join('');
    const moments = r.moments.map((m) => `<li>${iconBadge(`moment:${m.kind}`, 16)} ${t(`moment.${m.kind}`, { a: name(m.a), b: m.b ? name(m.b) : '' })}</li>`).join('');
    this.el.className = 'screen node-screen';
    this.el.innerHTML = `<div class="panel node-panel" data-testid="week-report"><h2>${r.week}주차 보고 — ${KIND[r.kind]}</h2>
      ${notes ? `<ul>${notes}</ul>` : ''}${xp ? `<h3>성장</h3><ul class="xp-list">${xp}</ul>` : ''}
      ${r.gold ? `<p>골드 <b class="gold">+${r.gold}</b></p>` : ''}${items ? `<h3>얻은 장비</h3><ul class="loot">${items}</ul>` : ''}
      ${moments ? `<h3>이번 주의 순간들</h3><ul class="moments">${moments}</ul>` : ''}
      <div class="choice-list"><button class="btn primary" data-testid="next-week">다음 주로</button></div></div>`;
    this.el.querySelector('button')!.addEventListener('click', this.next);
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
