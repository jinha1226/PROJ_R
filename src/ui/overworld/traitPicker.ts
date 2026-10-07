import { unitOf, type Party, type Unit } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { levelOf } from '../../sim/party/partyLevel';
import { TRAITS, rank } from '../../sim/party/traitDefs';
import { traitText } from '../../sim/party/traitText';
import { KIND_NAME, type TraitDef } from '../../sim/party/traitTypes';
import { RESONANCE_AT, tagCount } from '../../sim/party/resonance';
import { achraLine } from './richText';
import { CLASS_TINT, classIcon } from './classIcons';

/** The level-up choice, in the Pip-Boy frame: three traits as cards (name, the rank it would reach, what that rank does). The game waits while it is open. */
export class TraitPicker {
  readonly el = document.createElement('div');
  private who = '';

  constructor(private readonly p: () => Party, private readonly pick: (id: string, trait: string) => void, private readonly onClose: () => void, private readonly reroll?: (id: string) => void) {
    this.el.className = 'pip-win trait-win';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const card = t.closest<HTMLElement>('[data-trait]');
      if (card) { this.pick(this.who, card.dataset.trait!); if (unitOf(this.p(), this.who)?.picks) this.draw(); else this.close(); return; }
      if (t.closest('[data-reroll]') && this.reroll) { this.reroll(this.who); this.draw(); return; }
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
      const d = TRAITS[id]!, r = rank(u, id), own = d.pool in CLASSES, kind = r > 0 ? '강화' : d.kind ? KIND_NAME[d.kind] : '';
      return `<button type="button" class="trait-card${own ? ' own' : ''}${d.kind === 'duo' ? ' duo' : ''}" data-trait="${id}"><b>${d.name}</b><span class="kind">${kind}</span>`
        + `<p class="trait-text">${achraLine(r > 0 && d.up ? d.up : traitText(id, 1))}</p><em>${d.tags.map((t) => `#${t}`).join(' ')}</em>${r === 0 ? lights(this.p(), u, d) : ''}</button>`;
    }).join('');
    this.el.innerHTML = `<div class="pip-frame trait-frame"><header><span class="trait-who" style="--tint:${CLASS_TINT[u.cls!]}">${classIcon(u.cls!)} ${CLASSES[u.cls!].name} · 레벨 ${levelOf(u)}</span><span class="pip-title">특성 선택${(u.picks ?? 0) > 1 ? ` · 남은 선택 ${u.picks}` : ''}</span>${this.reroll && (u.rerolls ?? 0) > 0 ? `<button type="button" class="trait-reroll" data-reroll>다시 뽑기 ${u.rerolls}</button>` : ''}<button type="button" data-close>✕</button></header>
      <div class="trait-cards">${cards}</div><footer>Esc 닫기</footer></div>`;
  }
}

/** The resonance this card would light: '#화염 3 → 공명' (nothing when it lights none). */
function lights(p: Party, u: Unit, d: TraitDef): string {
  const n = tagCount(p, u);
  const lit = d.tags.filter((t) => RESONANCE_AT.some((at) => (n[t] ?? 0) < at && (n[t] ?? 0) + 1 >= at));
  return lit.length ? `<small class="lights">${lit.map((t) => `#${t} ${(n[t] ?? 0) + 1} → 공명`).join(' · ')}</small>` : '';
}
