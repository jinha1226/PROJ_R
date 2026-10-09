import { canPrintClone } from '../../sim/base/cloner';
import { canUpgradeDrill, drillCost, startFloors, upgradeDrill } from '../../sim/base/drill';
import { canUpgrade, cloneCap, GATHER, moduleAt, moduleOf, repairModule, upgrade, upgradeCost, WORKSHOP_REPAIR, type BaseUpgrade, type ModuleId } from '../../sim/base/modules';
import type { Cell, GEvent } from '../../sim/grid/types';
import type { Unit } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { canDrill, type WorldParty } from '../../sim/overworld/worldSim';
import { BODY_COST, canTakeSoul, living } from '../../sim/roam/roam';

/** what a tap on the base opens: the core (send a clone down, the lift, gathering) or one of its modules */
export interface PanelHit { kind: 'pod' | ModuleId }
export const MODULE_NAMES: Record<ModuleId, string> = { lab: '연구실', quarters: '숙소', workshop: '작업장' };

/** The panel under a tapped cell (the core's four cells, a module's four), else null. */
export function panelAt(p: WorldParty, c: Cell): PanelHit | null {
  if (p.drill && c.x >= p.drill.x && c.x <= p.drill.x + 1 && c.y >= p.drill.y && c.y <= p.drill.y + 1) return { kind: 'pod' };
  const m = moduleAt(p, c);
  return m ? { kind: m.id } : null;
}

const name = (u: Unit) => CLASSES[u.cls!].name;
const frame = (title: string, body: string) => `<div class="pip-frame menu-frame base-frame"><header><span class="pip-title">${title}</span><button type="button" data-close>✕</button></header><div class="menu-body">${body}</div></div>`;
const price = (c: readonly [number, number]): string => `광석 ${c[0]}${c[1] ? ` · 마정석 ${c[1]}` : ''}`;
/** one upgrade's row: what it gives, then its price on a key (or, at the top, a word that it is done) */
const upRow = (p: WorldParty, id: BaseUpgrade, label: string, done: string, verb = '강화'): string => {
  const cost = upgradeCost(p, id);
  return `<div class="menu-row"><span>${label}</span>${cost ? `<button type="button" data-up="${id}" ${canUpgrade(p, id) ? '' : 'disabled'}>${verb} · ${price(cost)}</button>` : `<small>${done}</small>`}</div>`;
};

/** The core: the start floor, each clone at home with its send button, the lift, gathering. */
export function podPanelHtml(p: WorldParty, floor: number, kept?: number): string {
  const floors = kept ? '' : startFloors(p).length > 1 ? `<div class="menu-row">${startFloors(p).map((f) => `<button type="button" data-floor="${f}" class="${f === floor ? 'on' : ''}">${f}층</button>`).join('')}</div>` : '';
  const rows = living(p).map((u) => `<div class="menu-row"><span>${name(u)} · 레벨 ${u.level ?? 1}</span><button type="button" data-send="${u.id}" ${canDrill(p, u.id) ? '' : 'disabled'}>보내기</button></div>`).join('');
  const next = drillCost(p.drillLevel + 1);
  const lift = `<div class="menu-row"><span>승강기 ${p.drillLevel}단계 · 시작 층 ${startFloors(p).join(' ')}</span>${next ? `<button type="button" data-drill ${canUpgradeDrill(p) ? '' : 'disabled'}>강화 · 광석 ${next.ore}${next.crystal ? ` · 마정석 ${next.crystal}` : ''}</button>` : '<small>최대</small>'}</div>`;
  const gather = upRow(p, 'gather', `채집 · 남은 클론마다 광석 ${GATHER.ore} · 생체 ${GATHER.bio}`, '가동 중', '켜기');
  return frame('코어', `<p class="base-sub">${kept ? `▼ ${kept}층 복귀` : '▼ 지하로'}</p>${floors}${rows}${lift}${gather}`);
}

const broken = (p: WorldParty, id: ModuleId): boolean => !!moduleOf(p, id)?.broken;

/** The lab: print a body (bio-matter and a bed permitting), put carried souls into bodies, the medical bay. */
export function labPanelHtml(p: WorldParty): string {
  const n = living(p).length, cap = cloneCap(p), full = n >= cap;
  const print = `<div class="menu-row"><span>${full ? `클론 ${n}/${cap} · 침상 없음` : `클론 생성 · 생체 ${p.bio}/${BODY_COST}`}</span><button type="button" data-print ${canPrintClone(p) ? '' : 'disabled'}>생성</button></div>`;
  const takers = living(p).filter((u) => canTakeSoul(p, u));
  const souls = p.carried.map((s, i) => `<div class="menu-row"><span>영혼 · ${CLASSES[typeof s === 'string' ? s : s.cls].name}</span>${takers.map((u) => `<button type="button" data-implant="${u.id}:${i}">${name(u)}에 주입</button>`).join('') || '<small>빈 몸 없음</small>'}</div>`).join('');
  return frame(MODULE_NAMES.lab, `${print}${souls}${upRow(p, 'medical', '의료 · 귀환 시 완전 회복', '가동 중', '켜기')}`);
}

/** The quarters: how many clones the base holds, and another bed. */
export function quartersPanelHtml(p: WorldParty): string {
  const cap = cloneCap(p);
  return frame(MODULE_NAMES.quarters, `<div class="menu-row"><span>클론 ${living(p).length}/${cap}</span></div>${upRow(p, 'beds', `침상 ${cap} → ${cap + 1}`, '최대')}`);
}

/** The workshop: broken until it is mended once; then the bench (the empty body's gun and suit, taking gear apart) and better salvage. */
export function workshopPanelHtml(p: WorldParty): string {
  if (broken(p, 'workshop')) return frame(MODULE_NAMES.workshop, `<p class="base-sub warn">고장 · 수리해야 켜진다</p><div class="menu-row"><span>수리</span><button type="button" data-fix ${p.ore >= WORKSHOP_REPAIR ? '' : 'disabled'}>광석 ${WORKSHOP_REPAIR}</button></div>`);
  return frame(MODULE_NAMES.workshop, `<div class="menu-row"><button type="button" data-bench>작업대 열기</button></div>${upRow(p, 'salvage', '분해 효율 25% → 35%', '분해 효율 35%')}`);
}

/** The panel window over the base: shows one panel, routes its buttons. */
export class BasePanels {
  readonly el = document.createElement('div');
  private hit: PanelHit | null = null;
  private floor = 1;
  /** when it opened: the tap that opened it must not also press the key that appears under the finger */
  private shownAt = 0;

  constructor(private readonly p: () => WorldParty, private readonly act: { send: (id: string, floor: number) => void; print: () => void; implant: (id: string, soul: number) => void; bench: () => void; live: (ev: GEvent[]) => void }, private readonly kept: () => number | undefined) {
    this.el.className = 'pip-win menu-win base-panel';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (performance.now() - this.shownAt < 350) return;
      if (e.target === this.el || t?.hasAttribute('data-close')) { this.close(); return; }
      if (!t || !this.hit) return;
      const p = this.p(), kind = this.hit.kind;
      if (t.dataset.floor) this.floor = Number(t.dataset.floor);
      if (t.dataset.send) { this.close(); this.act.send(t.dataset.send, this.floor); return; }
      if (t.hasAttribute('data-print')) this.act.print();
      if (t.dataset.implant) { const [id, i] = t.dataset.implant.split(':'); this.act.implant(id!, Number(i)); }
      if (t.hasAttribute('data-bench')) { this.close(); this.act.bench(); return; }
      if (t.hasAttribute('data-fix') && kind !== 'pod') repairModule(p, kind);
      if (t.dataset.up) upgrade(p, t.dataset.up as BaseUpgrade);
      if (t.hasAttribute('data-drill')) { const ev: GEvent[] = []; if (upgradeDrill(p, ev)) this.act.live(ev); }
      this.draw();
    });
  }

  get open(): boolean { return !this.el.hidden; }
  show(hit: PanelHit): void { this.hit = hit; this.floor = 1; this.shownAt = performance.now(); this.el.hidden = false; this.draw(); }
  close(): void { this.el.hidden = true; this.hit = null; }
  draw(): void {
    const p = this.p(), h = this.hit;
    if (!h) return;
    this.el.innerHTML = h.kind === 'pod' ? podPanelHtml(p, this.floor, this.kept()) : h.kind === 'lab' ? labPanelHtml(p) : h.kind === 'quarters' ? quartersPanelHtml(p) : workshopPanelHtml(p);
  }
}
