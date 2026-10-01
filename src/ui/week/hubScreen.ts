import type { Screen } from '../../app/router';
import { ROSTER_CAP } from '../../sim/run/recruit';
import { LAST_WEEK, type Candidate, type RunState } from '../../sim/run/types';
import { canExplore } from '../../sim/week/week';
import { t } from '../i18n/ko';
import { runHud } from '../run/runHud';
import '../styles/week.css';

export interface HubApi {
  run(): RunState;
  recruit(c: Candidate): void;
  skipVisitors(): void;
  openEvent(): void;
  explore(cardIndex: number, party: string[]): void;
  train(ids: string[]): void;
  rest(a?: string, b?: string): void;
  shop(): void;
  roster(): void;
  quit(): void;
}

type Panel = 'none' | 'explore' | 'train' | 'rest';
const THEME: Record<string, string> = { forest: '안개 낀 숲', dungeon: '무너진 지하 던전', graveyard: '저주받은 묘지' };
const REWARD: Record<string, string> = { gold: '골드', gear: '장비', xp: '경험치' };
const MAX_PARTY = 5;

/** The week's home: visitors, the start event, and the three weekly actions. */
export class HubScreen implements Screen {
  private el = document.createElement('div');
  private panel: Panel = 'none';
  private card = 0;
  private picked = new Set<string>();

  constructor(private readonly api: HubApi) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen week-hub';
    this.el.addEventListener('click', (e) => this.onClick(e));
    root.appendChild(this.el);
    this.render();
  }

  private visitors(run: RunState): string {
    if (!run.visitors?.length) return '';
    const full = run.roster.mercs.length >= ROSTER_CAP;
    const cards = run.visitors.map((c, i) => {
      const m = c.merc;
      const why = full ? '용병단이 가득 찼다' : run.gold < c.fee ? '골드 부족' : '';
      return `<div class="candidate" style="--c:${m.color}"><b>${m.name}</b><span>Lv${m.level} ${t(`class.${m.classId}`)} · ${t(`trait.${m.revealed[0]}`)}</span>
        <span class="muted">${m.backstory}</span><button class="btn primary" data-recruit="${i}" data-testid="visitor-${i}" ${why ? 'disabled' : ''}>${c.fee ? `영입 ${c.fee}G` : '영입 (무료)'}</button>${why ? `<small class="muted">${why}</small>` : ''}</div>`;
    }).join('');
    return `<section class="panel"><h3>찾아온 이들</h3><p class="muted">일거리를 찾는 이들이 용병단 숙소를 찾아왔다.</p><div class="candidates">${cards}</div>
      <button class="btn" data-act="skip" data-testid="skip-visitors">돌려보낸다</button></section>`;
  }

  private chips(run: RunState, healthyOnly: boolean): string {
    return `<div class="pick-chips">${run.roster.mercs.map((m) => {
      const off = healthyOnly && m.injury > 0;
      return `<button class="fchip ${this.picked.has(m.id) ? 'sel' : ''} ${m.injury ? 'hurt' : ''}" style="--c:${m.color}" data-pick="${m.id}" data-testid="pick-${m.id}" ${off ? 'disabled' : ''}>
        <b>${m.name}</b><small>Lv${m.level} ${t(`class.${m.classId}`)}${m.injury ? ` · 부상 ${m.injury}` : ''}</small></button>`;
    }).join('')}</div><p class="muted">선택 ${this.picked.size}/${MAX_PARTY}</p>`;
  }

  private panelHtml(run: RunState): string {
    if (this.panel === 'explore') {
      const cards = (run.regionCards ?? []).map((c, i) => `<button class="region ${i === this.card ? 'sel' : ''} t-${c.theme}" data-card="${i}" data-testid="region-${i}">
        <b>${THEME[c.theme]}</b><span class="stars">${'★'.repeat(c.stars)}${'☆'.repeat(3 - c.stars)}</span><span>보상: ${REWARD[c.reward]} · 방 ${c.rooms}개</span></button>`).join('');
      return `<section class="panel"><h3>탐험할 곳</h3><div class="regions">${cards}</div><h4>탐험대 (부상자 제외, 최대 5명)</h4>${this.chips(run, true)}
        <button class="btn primary" data-act="go-explore" data-testid="go-explore" ${this.picked.size ? '' : 'disabled'}>출발</button></section>`;
    }
    if (this.panel === 'train') {
      return `<section class="panel"><h3>훈련</h3><p class="muted">선택한 동료가 위험 없이 경험치를 얻는다 (다음 레벨까지의 40%).</p>${this.chips(run, false)}
        <button class="btn primary" data-act="go-train" data-testid="go-train" ${this.picked.size ? '' : 'disabled'}>훈련한다</button></section>`;
    }
    if (this.panel === 'rest') {
      const opts = (sel: number) => run.roster.mercs.map((m, i) => `<option value="${m.id}" ${i === sel ? 'selected' : ''}>${m.name}</option>`).join('');
      return `<section class="panel"><h3>휴식</h3><p class="muted">모두의 부상이 낫는다. 두 사람을 골라 이야기를 나누게 할 수 있다.</p>
        ${run.roster.mercs.length >= 2 ? `<div class="talk"><select data-testid="rest-a">${opts(0)}</select> 와(과) <select data-testid="rest-b">${opts(1)}</select></div>` : ''}
        <button class="btn primary" data-act="go-rest" data-testid="go-rest">쉰다</button></section>`;
    }
    return '';
  }

  render(): void {
    const run = this.api.run();
    const explore = canExplore(run);
    const blocked = run.phase === 'start';
    this.el.innerHTML = `${runHud(run)}<div class="week-body">
      <div class="week-banner"><h1>${run.week}주차</h1><p>${run.week < LAST_WEEK ? `잿빛 기사의 습격까지 <b>${LAST_WEEK - run.week}주</b>` : '잿빛 기사가 왔다'}</p></div>
      ${this.visitors(run)}
      ${run.startEvent ? `<section class="panel"><h3>${t(`event.${run.startEvent.eventId}.title`)}</h3><button class="btn primary" data-act="event" data-testid="open-start-event">무슨 일인지 본다</button></section>` : ''}
      <section class="panel week-actions"><h3>이번 주에 할 일</h3>
        <button class="btn action" data-panel="explore" data-testid="act-explore" ${!explore || blocked ? 'disabled' : ''}>탐험<small>${explore ? '지역을 골라 출정한다' : '움직일 수 있는 동료가 없다'}</small></button>
        <button class="btn action" data-panel="train" data-testid="act-train" ${blocked ? 'disabled' : ''}>훈련<small>위험 없이 성장한다</small></button>
        <button class="btn action" data-panel="rest" data-testid="act-rest" ${blocked ? 'disabled' : ''}>휴식<small>부상 회복 · 친목</small></button>
        <button class="btn" data-act="shop" data-testid="open-shop">상점</button></section>
      ${this.panelHtml(run)}</div>`;
  }

  private onClick(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t || (t as HTMLButtonElement).disabled) return;
    const run = this.api.run();
    if (t.dataset.recruit) return this.api.recruit(run.visitors![Number(t.dataset.recruit)]!);
    if (t.dataset.panel) { this.panel = t.dataset.panel as Panel; this.picked.clear(); return this.render(); }
    if (t.dataset.card) { this.card = Number(t.dataset.card); return this.render(); }
    if (t.dataset.pick) {
      const id = t.dataset.pick;
      if (this.picked.has(id)) this.picked.delete(id);
      else if (this.picked.size < MAX_PARTY) this.picked.add(id);
      return this.render();
    }
    const sel = (id: string) => this.el.querySelector<HTMLSelectElement>(`[data-testid="${id}"]`)?.value;
    switch (t.dataset.act) {
      case 'skip': return this.api.skipVisitors();
      case 'event': return this.api.openEvent();
      case 'go-explore': return this.api.explore(this.card, [...this.picked]);
      case 'go-train': return this.api.train([...this.picked]);
      case 'go-rest': return this.api.rest(sel('rest-a'), sel('rest-b'));
      case 'shop': return this.api.shop();
      case 'roster': return this.api.roster();
      case 'quit': return this.api.quit();
    }
  }

  unmount(): void {
    this.el.remove();
  }
}
