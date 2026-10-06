import { unitOf, type Party } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { levelOf } from '../../sim/party/partyLevel';
import { TRAITS, rank } from '../../sim/party/traitDefs';
import { traitText } from '../../sim/party/traitText';
import { CLASS_TINT, classIcon } from './classIcons';

/** The level-up choice, in the Pip-Boy frame: three traits as cards (name, the rank it would reach, what that rank does). The game waits while it is open. */
export class TraitPicker {
  readonly el = document.createElement('div');
  private who = '';

  constructor(private readonly p: () => Party, private readonly pick: (id: string, trait: string) => void, private readonly onClose: () => void) {
    this.el.className = 'pip-win trait-win';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const card = t.closest<HTMLElement>('[data-trait]');
      if (card) { this.pick(this.who, card.dataset.trait!); if (unitOf(this.p(), this.who)?.picks) this.draw(); else this.close(); return; }
      if (t.closest('[data-close]') || t === this.el) this.close();
    });
  }

  get open(): boolean { return !this.el.hidden; }
  show(who: string): void { this.who = who; this.el.hidden = false; this.draw(); }
  close(): void { if (this.el.hidden) return; this.el.hidden = true; this.onClose(); }

  private draw(): void {
    const u = unitOf(this.p(), this.who);
    if (!u?.offer?.length) { this.close(); return; }
    const cards = u.offer.map((id) => {
      const d = TRAITS[id]!, r = rank(u, id);
      const pips = Array.from({ length: d.ranks }, (_, i) => `<i class="${i < r ? 'on' : i === r ? 'next' : ''}"></i>`).join('');
      return `<button type="button" class="trait-card${(d.pool !== 'common' && d.pool !== 'keystone' ? d.pool : undefined) ? ' own' : ''}" data-trait="${id}"><b>${d.name}</b><span class="pips">${pips}</span><p class="trait-text">${traitText(id, Math.min(d.ranks, r + 1))}</p><em>${d.tags.join(' · ')}</em>${(d.pool !== 'common' && d.pool !== 'keystone' ? d.pool : undefined) ? `<small>${(d.pool !== 'common' && d.pool !== 'keystone' ? CLASSES[d.pool].name : '')} 전용</small>` : ''}</button>`;
    }).join('');
    this.el.innerHTML = `<div class="pip-frame trait-frame"><header><span class="trait-who" style="--tint:${CLASS_TINT[u.cls!]}">${classIcon(u.cls!)} ${CLASSES[u.cls!].name} · 레벨 ${levelOf(u)}</span><span class="pip-title">특성 선택${(u.picks ?? 0) > 1 ? ` · 남은 선택 ${u.picks}` : ''}</span><button type="button" data-close>✕</button></header>
      <div class="trait-cards">${cards}</div><footer>Esc 닫기</footer></div>`;
  }
}
