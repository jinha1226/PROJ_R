import type { Screen } from '../../app/router';
import type { Aftermath } from '../../sim/roster/aftermath';
import type { Roster } from '../../sim/roster/types';
import { t } from '../i18n/ko';
import { itemLabel } from '../company/text';
import { iconBadge } from '../../view/overlay/icons';

/** After a company battle: xp, level-ups, wounds, scars, deaths, titles, loot, and moments. */
export class AftermathScreen implements Screen {
  private el = document.createElement('div');

  constructor(private readonly a: Aftermath, private readonly before: Roster, private readonly onDone: () => void) {}

  mount(root: HTMLElement): void {
    const r = this.a.roster;
    const name = (id: string) => (r.mercs.find((m) => m.id === id) ?? r.memorial.find((m) => m.id === id) ?? this.before.mercs.find((m) => m.id === id))?.name ?? id;
    const rows = Object.entries(this.a.xp).map(([id, xp]) => {
      const m = r.mercs.find((x) => x.id === id)!;
      const tags = [
        this.a.levelUps.includes(id) ? `<span class="badge up">Lv${m.level}!</span>` : '',
        this.a.injuries.includes(id) ? '<span class="badge hurt">부상</span>' : '',
        ...this.a.scars.filter((s) => s.id === id).map((s) => `<span class="badge scar">흉터: ${t(`scar.${s.scar}`)}</span>`),
        ...this.a.titles.filter((s) => s.id === id).map((s) => `<span class="badge title">별명 "${t(`title.${s.title}`)}"</span>`),
        ...this.a.revealed.filter((s) => s.id === id).map((s) => `<span class="badge reveal">성격: ${t(`trait.${s.trait}`)}</span>`),
      ].join('');
      return `<li><b>${name(id)}</b> <span class="xp">+${xp} XP</span> ${tags}</li>`;
    }).join('');
    const deaths = this.a.deaths.map((id) => `<li class="death">✝ ${name(id)} 전사</li>`).join('');
    const loot = this.a.loot.map((id) => { const l = itemLabel(id); return `<li class="item tier-${l.tier}"><b>${l.name}</b> <small>${t(`tier.${l.tier}`)}</small> <small class="muted">${l.detail}</small></li>`; }).join('');
    const moments = this.a.moments.map((m) => `<li>${iconBadge(`moment:${m.kind}`, 18)} ${t(`moment.${m.kind}`, { a: name(m.a), b: m.b ? name(m.b) : '' })}</li>`).join('');
    this.el.className = 'screen aftermath';
    this.el.dataset.testid = 'aftermath';
    this.el.innerHTML = `<div class="panel aftermath-panel"><h2>전투 ${r.battles} 결과</h2>
      <ul class="xp-list">${rows}${deaths}</ul>
      ${loot ? `<h3>전리품</h3><ul class="loot">${loot}</ul>` : ''}
      ${moments ? `<h3>${t('ui.moments')}</h3><ul class="moments">${moments}</ul>` : ''}
      <button class="btn primary" data-testid="to-hub">용병단으로</button></div>`;
    this.el.querySelector('[data-testid="to-hub"]')!.addEventListener('click', this.onDone);
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
