import type { GEvent } from '../../sim/grid/types';
import { traitText } from '../../sim/party/traitText';
import { KIND_NAME } from '../../sim/party/traitTypes';
import { MEMORIES } from '../../sim/party/memories';
import { linesOf, memoriesOf, soulsOf } from '../../sim/party/body';
import { soulListHtml } from './pipSouls';
import { bagHtml } from './pipBag';
import { resonanceHtml } from './resonanceHtml';
import { dmgText, gearHtml } from './pipGear';
import { rosterHtml } from './pipRoster';
import { useConsumable } from './quickSlots';
import { skillsHtml } from './pipSkills';
import { itemName } from '../../sim/delve/items';
import { equip,unequip,sacrifice,weaponStats } from '../../sim/delve/gear';
import { CATALOG } from '../../sim/delve/catalog';
import { entOf, unitOf, type Unit } from '../../sim/party/partyCore';
import { CLASSES, WEAPONS } from '../../sim/party/partyDefs';
import { canTakeSoul, clones, implantCarried, slotsOf, type RoamParty } from '../../sim/roam/roam';
import { CLASS_TINT, classIcon } from './classIcons';
import { LEVEL_XP, MAX_LEVEL, levelOf } from '../../sim/party/partyLevel';
import { TRAITS, rank, type TraitId } from '../../sim/party/traitDefs';

export type PipTab = 'roster' | 'stat' | 'skill' | 'gear' | 'bag' | 'soul';
const TAB_NAME: Record<PipTab, string> = { roster: '명단', stat: '상태', skill: '기술', gear: '장비', bag: '가방', soul: '영혼석' };
/** the window's tabs: down in the dungeon there is one clone and no base, so no roster and no soul-stone tab (stones picked up lie in the bag) */
export const pipTabs = (below: boolean): PipTab[] => (below ? ['stat', 'skill', 'gear', 'bag'] : ['roster', 'stat', 'skill', 'gear', 'bag', 'soul']);

import { SKILLS } from '../../sim/party/skills';
import { sheetPick, skillSheetClick, skillSheetHtml } from './skillSheet';
/** The Pip-Boy style window: the clones' records (status), their gear, the class tree, and what the party carries (bag). The game waits while it is open. */
export class PipWindow {
  readonly el = document.createElement('div');
  tab: PipTab = 'stat';
  private who = '';
  /** the thing chosen in the bag's grid (`ore`, `soul:2`, `item:<id>`): its line shows under the grid */
  private pick = '';
  private readonly sheet = sheetPick();

  /** onEvents: what a promotion set off, for the screen to show */
  /** `below`: down in the dungeon the window keeps to the one clone there (no roster, no soul-stone tab: stones picked up lie in the bag) */
  constructor(private readonly p: () => RoamParty, private readonly onClose: () => void, private readonly onEvents?: (ev: GEvent[]) => void, private readonly below = false) {
    this.el.className = 'pip-win pip-main';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const tab = t.closest<HTMLElement>('[data-tab]')?.dataset.tab as PipTab | undefined;
      const who = t.closest<HTMLElement>('[data-who]')?.dataset.who;
      if (tab) this.tab = tab;
      const pick = t.closest<HTMLElement>('[data-pick]')?.dataset.pick;
      if (pick !== undefined) this.pick = this.pick === pick ? '' : pick;
      if (who) this.who = who;
      const act=t.closest<HTMLElement>('[data-item]');
      if(act){const p=this.p(),id=act.dataset.item!,u=unitOf(p,this.who)||clones(p).find(u=>entOf(p,u.id)?.alive);if(u){if(act.dataset.action==='equip')equip(p,u.id,id);if(act.dataset.action==='sacrifice')sacrifice(p,u.id,id);if(act.dataset.action==='use')this.onEvents?.(useConsumable(p,u.id,id));}}
      const soul = t.closest<HTMLElement>('[data-soul]')?.dataset.soul, body = soul !== undefined && this.shell(this.p());
      if (body) this.onEvents?.(implantCarried(this.p(), body.id, Number(soul)));
      const slot=t.closest<HTMLElement>('[data-off]')?.dataset.off as 'weapon'|'armor'|'accessory'|undefined;
      if(slot)unequip(this.p(),this.who,slot);
      if (SKILLS.on && this.tab === 'skill') skillSheetClick(t, this.p(), this.who, this.sheet);
      if (t.closest('[data-close]') || t === this.el) { this.close(); return; }
      this.draw();
    });
  }

  get open(): boolean { return !this.el.hidden; }

  /** the fresh body a soul goes into: the chosen clone if it can take one, else the first that can */
  private shell(p: RoamParty): Unit | undefined {
    const empty = clones(p).filter((u) => entOf(p, u.id)?.alive && canTakeSoul(p, u));
    return empty.find((u) => u.id === this.who) ?? empty[0];
  }

  private get tabs(): PipTab[] { return pipTabs(this.below); }
  show(tab: PipTab, who: string): void { if (!this.tabs.includes(tab)) return; this.tab = tab; this.who = who; this.el.hidden = false; this.draw(); }
  close(): void { if (this.el.hidden) return; this.el.hidden = true; this.onClose(); }
  toggle(tab: PipTab, who: string): void { if (this.open && this.tab === tab) this.close(); else this.show(tab, who); }

  private draw(): void {
    const p = this.p();
    const tabs = this.tabs.map((k) => `<button type="button" data-tab="${k}" class="${this.tab === k ? 'on' : ''}">${TAB_NAME[k]}</button>`).join('');
    const body = this.tab === 'roster' ? rosterHtml(p) : this.tab === 'stat' ? this.stat(p) : this.tab === 'bag' ? this.bag(p) : this.tab === 'soul' ? soulListHtml(p, !p.printHere)
      : `${this.side(p)}${this.tab === 'skill' ? (SKILLS.on ? skillSheetHtml(p, unitOf(p, this.who), this.sheet) : skillsHtml(p, unitOf(p, this.who))) : gearHtml(p, unitOf(p, this.who))}`;
    const keys = this.below ? 'C 상태 · K 기술 · E 장비 · I 가방 · Esc 닫기' : 'L 명단 · C 상태 · K 기술 · E 장비 · I 가방 · J 영혼석 · Esc 닫기';
    this.el.innerHTML = `<div class="pip-frame"><header>${tabs}<span class="pip-title">R-7 기록 장치</span><button type="button" data-close>✕</button></header>
      <div class="pip-body">${body}</div><footer>${keys}</footer></div>`;
  }

  /** the living clones to choose from, when there is more than one to choose (one clone alone needs no list; empty pods are not shown) */
  private side(p: RoamParty): string {
    const list = clones(p).filter((u) => entOf(p, u.id)?.alive);
    if (!list.some((u) => u.id === this.who)) this.who = list[0]?.id ?? '';
    if (list.length < 2) return '';
    return `<nav class="pip-side">${list.map((u) => `<button type="button" data-who="${u.id}" class="${u.id === this.who ? 'on' : ''}" style="--tint:${CLASS_TINT[u.cls!]}">${classIcon(u.cls!)}${CLASSES[u.cls!].name}</button>`).join('')}</nav>`;
  }

  private stat(p: RoamParty): string {
    const side = this.side(p);
    const u = unitOf(p, this.who), e = u && entOf(p, u.id);
    if (!u || !e) return side;
    const cls = CLASSES[u.cls!], w = {...WEAPONS[u.weapon!],...weaponStats(u),name:u.gear?.weapon?itemName(u.gear.weapon):WEAPONS[u.weapon!].name,note:u.gear?.weapon?CATALOG[u.gear.weapon.def]!.tags.join(' · '):WEAPONS[u.weapon!].note};
    const mems = memoriesOf(u).map((m) => MEMORIES[m]);
    const lv = `<dt>레벨</dt><dd>${levelOf(u)} <small>경험 ${u.xp ?? 0}${levelOf(u) < MAX_LEVEL ? ` / ${LEVEL_XP[levelOf(u)]}` : ''}</small></dd>`;
    const traits = (Object.keys(u.traits ?? {}) as TraitId[]).filter((id) => TRAITS[id]).map((id) => `<li><b>${TRAITS[id]!.name}${rank(u, id) >= 2 ? ' +' : ''} <small>${TRAITS[id]!.kind ? KIND_NAME[TRAITS[id]!.kind!] : ''}</small></b><span>${traitText(id, rank(u, id))}</span><em>${TRAITS[id]!.tags.map((g) => `#${g}`).join(' ')}</em></li>`).join('') || '<li class="dim">없음</li>';
    return `${side}<section class="pip-rec${side ? '' : ' wide'}">
      <h3 style="--tint:${CLASS_TINT[u.cls!]}">${classIcon(u.cls!)} ${linesOf(u).length > 1 ? linesOf(u).map((c) => CLASSES[c].name).join(' + ') : cls.name}</h3>
      <dl>${lv}<dt>영혼</dt><dd>${soulsOf(u).length} / ${slotsOf(p)}</dd><dt>체력</dt><dd>${e.hp} / ${e.maxHp}</dd><dt>보호막</dt><dd>${u.shield}</dd><dt>이동</dt><dd>${(1 / cls.move).toFixed(1)} 칸/턴</dd>
      <dt>무기</dt><dd>${w.name} <small>${w.note}</small></dd><dt>피해</dt><dd>${u.gear?.weapon ? dmgText(u.gear.weapon) : `${w.dmg[0]}-${w.dmg[1]}`} · ${(1 / w.atk).toFixed(1)}회/턴 · 사거리 ${w.range}</dd>
      <dt>각인</dt><dd>${cls.passiveName || '—'}</dd>${mems.length ? `<dt>기억</dt><dd>${mems.map((m) => `${m.name} <small>${m.text}</small>`).join('<br>')}</dd>` : ''}</dl>
      <h4>특성</h4><ul class="pip-skills">${traits}</ul>${resonanceHtml(p, u)}</section>`;
  }

  private bag(p: RoamParty): string { return bagHtml(p, unitOf(p, this.who) ?? clones(p).find((x) => entOf(p, x.id)?.alive), this.pick, !!this.shell(p)); }
}
