import { entOf, unitOf } from '../../sim/party/partyCore';
import { CLASSES, PROMOTIONS, SKILLS, WEAPONS } from '../../sim/party/partyDefs';
import { clones, MAX_CLONES, type WorldParty } from '../../sim/overworld/worldSim';
import { CLASS_TINT, SKILL_DESC, classIcon } from './classIcons';

export type PipTab = 'stat' | 'bag';
const BAG_SLOTS = 12;

/** The Pip-Boy style window: the clones' records (status) and what the party carries (bag). The game waits while it is open. */
export class PipWindow {
  readonly el = document.createElement('div');
  tab: PipTab = 'stat';
  private who = '';

  constructor(private readonly p: () => WorldParty, private readonly onClose: () => void) {
    this.el.className = 'pip-win';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const tab = t.closest<HTMLElement>('[data-tab]')?.dataset.tab as PipTab | undefined;
      const who = t.closest<HTMLElement>('[data-who]')?.dataset.who;
      if (tab) this.tab = tab;
      if (who) this.who = who;
      if (t.closest('[data-close]') || t === this.el) { this.close(); return; }
      this.draw();
    });
  }

  get open(): boolean { return !this.el.hidden; }

  show(tab: PipTab, who: string): void { this.tab = tab; this.who = who; this.el.hidden = false; this.draw(); }
  close(): void { if (this.el.hidden) return; this.el.hidden = true; this.onClose(); }
  toggle(tab: PipTab, who: string): void { if (this.open && this.tab === tab) this.close(); else this.show(tab, who); }

  private draw(): void {
    const p = this.p();
    const tabs = (['stat', 'bag'] as const).map((k) => `<button type="button" data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${k === 'stat' ? '상태' : '가방'}</button>`).join('');
    this.el.innerHTML = `<div class="pip-frame"><header>${tabs}<span class="pip-title">R-7 기록 장치</span><button type="button" data-close>✕</button></header>
      <div class="pip-body">${this.tab === 'stat' ? this.stat(p) : this.bag(p)}</div><footer>C 상태 · I 가방 · Esc 닫기</footer></div>`;
  }

  private stat(p: WorldParty): string {
    const list = clones(p).filter((u) => entOf(p, u.id)?.alive);
    if (!list.some((u) => u.id === this.who)) this.who = list[0]?.id ?? '';
    const side = list.map((u) => `<button type="button" data-who="${u.id}" class="${u.id === this.who ? 'on' : ''}" style="--tint:${CLASS_TINT[u.cls!]}">${classIcon(u.cls!)}${CLASSES[u.cls!].name}</button>`).join('')
      + Array.from({ length: MAX_CLONES - list.length }, () => '<button type="button" class="empty" disabled>빈 포드</button>').join('');
    const u = unitOf(p, this.who), e = u && entOf(p, u.id);
    if (!u || !e) return `<nav class="pip-side">${side}</nav>`;
    const cls = CLASSES[u.cls!], w = WEAPONS[u.weapon!], promo = PROMOTIONS[u.cls!];
    const skills = cls.skills.length ? cls.skills.map((s) => `<li><b>${SKILLS[s].name}</b><span>${SKILL_DESC[s]}</span><em>대기 ${SKILLS[s].cd}초</em></li>`).join('') : '<li class="dim">없음</li>';
    return `<nav class="pip-side">${side}</nav><section class="pip-rec">
      <h3 style="--tint:${CLASS_TINT[u.cls!]}">${classIcon(u.cls!)} ${cls.name}</h3>
      <dl><dt>체력</dt><dd>${e.hp} / ${e.maxHp}</dd><dt>보호막</dt><dd>${u.shield}</dd><dt>이동</dt><dd>${(1 / cls.move).toFixed(1)} 칸/초</dd>
      <dt>무기</dt><dd>${w.name} <small>${w.note}</small></dd><dt>피해</dt><dd>${w.dmg[0]}–${w.dmg[1]} · ${(1 / w.atk).toFixed(1)}회/초 · 사거리 ${w.range}</dd>
      <dt>각인</dt><dd>${cls.passiveName || '—'}</dd>${promo ? `<dt>전직</dt><dd>${CLASSES[promo.to].name} · ${promo.label} ${u.progress}/${promo.need}${u.promoteReady ? ' <b>가능</b>' : ''}</dd>` : ''}</dl>
      <h4>기술</h4><ul class="pip-skills">${skills}</ul></section>`;
  }

  private bag(p: WorldParty): string {
    const items = p.carried.map((c) => `<div class="pip-slot soul" style="--tint:${CLASS_TINT[c]}">${classIcon(c)}<span>${CLASSES[c].name}의 영혼</span></div>`);
    const slots = [...items, ...Array.from({ length: Math.max(0, BAG_SLOTS - items.length) }, () => '<div class="pip-slot"></div>')].join('');
    return `<section class="pip-bag"><h4>들고 있는 것 <small>${items.length}/${BAG_SLOTS}</small></h4><div class="pip-grid">${slots}</div></section>`;
  }
}
