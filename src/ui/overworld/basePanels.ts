import { canPrintClone } from '../../sim/base/cloner';
import { canUpgrade, cloneCap, GATHER, moduleAt, moduleOf, repairModule, upgrade, upgradeCost, WORKSHOP_REPAIR, type BaseUpgrade, type ModuleId } from '../../sim/base/modules';
import type { Cell } from '../../sim/grid/types';
import type { Unit } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { BODY_COST, canTakeSoul, living } from '../../sim/roam/roam';

/** what a tap on the base lands on: the core (the way down: the screen swings to the floors) or one of its modules (its panel) */
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

const broken = (p: WorldParty, id: ModuleId): boolean => !!moduleOf(p, id)?.broken;

/** The lab: print a body (bio-matter and a bed permitting), put carried souls into bodies, the medical bay. */
export function labPanelHtml(p: WorldParty): string {
  const n = living(p).length, cap = cloneCap(p), full = n >= cap;
  const print = `<div class="menu-row"><span>${full ? `클론 ${n}/${cap} · 침상 없음` : `클론 생성 · 생체 ${p.bio}/${BODY_COST}`}</span><button type="button" data-print ${canPrintClone(p) ? '' : 'disabled'}>생성</button></div>`;
  const takers = living(p).filter((u) => canTakeSoul(p, u));
  const souls = p.carried.map((s, i) => `<div class="menu-row"><span>영혼 · ${CLASSES[typeof s === 'string' ? s : s.cls].name}</span>${takers.map((u) => `<button type="button" data-implant="${u.id}:${i}">${name(u)}에 주입</button>`).join('') || '<small>빈 몸 없음</small>'}</div>`).join('');
  return frame(MODULE_NAMES.lab, `${print}${souls}${upRow(p, 'medical', '의료 · 귀환 시 완전 회복', '가동 중', '켜기')}`);
}

/** The quarters: how many clones the base holds, another bed, and what those who stay home gather while one is below. */
export function quartersPanelHtml(p: WorldParty): string {
  const cap = cloneCap(p);
  const gather = upRow(p, 'gather', `채집 · 남은 클론마다 광석 ${GATHER.ore} · 생체 ${GATHER.bio}`, '가동 중', '켜기');
  return frame(MODULE_NAMES.quarters, `<div class="menu-row"><span>클론 ${living(p).length}/${cap}</span></div>${upRow(p, 'beds', `침상 ${cap} → ${cap + 1}`, '최대')}${gather}`);
}

/** The workshop: broken until it is mended once; then the bench (the empty body's gun and suit, taking gear apart) and better salvage. */
export function workshopPanelHtml(p: WorldParty): string {
  if (broken(p, 'workshop')) return frame(MODULE_NAMES.workshop, `<p class="base-sub warn">고장 · 수리해야 켜진다</p><div class="menu-row"><span>수리</span><button type="button" data-fix ${p.ore >= WORKSHOP_REPAIR ? '' : 'disabled'}>광석 ${WORKSHOP_REPAIR}</button></div>`);
  return frame(MODULE_NAMES.workshop, `<div class="menu-row"><button type="button" data-bench>작업대 열기</button></div>${upRow(p, 'salvage', '분해 효율 25% → 35%', '분해 효율 35%')}`);
}

/** The panel window over the base: shows one module's panel, routes its buttons. */
export class BasePanels {
  readonly el = document.createElement('div');
  private hit: ModuleId | null = null;
  /** when it opened: the tap that opened it must not also press the key that appears under the finger */
  private shownAt = 0;

  constructor(private readonly p: () => WorldParty, private readonly act: { print: () => void; implant: (id: string, soul: number) => void; bench: () => void }) {
    this.el.className = 'pip-win menu-win base-panel';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (performance.now() - this.shownAt < 350) return;
      if (e.target === this.el || t?.hasAttribute('data-close')) { this.close(); return; }
      if (!t || !this.hit) return;
      const p = this.p();
      if (t.hasAttribute('data-print')) this.act.print();
      if (t.dataset.implant) { const [id, i] = t.dataset.implant.split(':'); this.act.implant(id!, Number(i)); }
      if (t.hasAttribute('data-bench')) { this.close(); this.act.bench(); return; }
      if (t.hasAttribute('data-fix')) repairModule(p, this.hit);
      if (t.dataset.up) upgrade(p, t.dataset.up as BaseUpgrade);
      this.draw();
    });
  }

  get open(): boolean { return !this.el.hidden; }
  show(hit: ModuleId): void { this.hit = hit; this.shownAt = performance.now(); this.el.hidden = false; this.draw(); }
  close(): void { this.el.hidden = true; this.hit = null; }
  draw(): void {
    const p = this.p(), h = this.hit;
    if (!h) return;
    this.el.innerHTML = h === 'lab' ? labPanelHtml(p) : h === 'quarters' ? quartersPanelHtml(p) : workshopPanelHtml(p);
  }
}
