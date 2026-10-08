import { buildingsAt, levelOfBuilding, LEVELS, podRepairCost, POD_MAX, repairBuilding, repairCost, repairPod, upgradeBuilding } from '../../sim/base/buildings';
import { SUPPORT, unlockSupport, type SupportId } from '../../sim/base/support';
import { canPrintClone } from '../../sim/base/cloner';
import { startFloors } from '../../sim/base/drill';
import { same, type Cell } from '../../sim/grid/types';
import type { Unit } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { canDrill, type WorldParty } from '../../sim/overworld/worldSim';
import { BODY_COST, canTakeSoul, living, MAX_CLONES } from '../../sim/roam/roam';
import { BUILD_NAMES } from './buildMode';

/** what a click on the base opens: the pod (send a clone down), the lab (bodies, souls, workshop), a defence */
export interface PanelHit { kind: 'pod' | 'lab' | 'defence'; id?: string }

/** The panel under a clicked cell (the lab's own cell, the pod's four, a building's footprint), else null. */
export function panelAt(p: WorldParty, c: Cell): PanelHit | null {
  if (p.cloner && same(c, p.cloner)) return { kind: 'lab' };
  if (p.drill && c.x >= p.drill.x && c.x <= p.drill.x + 1 && c.y >= p.drill.y && c.y <= p.drill.y + 1) return { kind: 'pod' };
  const b = buildingsAt(p, c);
  return b ? { kind: 'defence', id: b.id } : null;
}

const name = (u: Unit) => CLASSES[u.cls!].name;
const frame = (title: string, body: string) => `<div class="pip-frame menu-frame base-frame"><header><span class="pip-title">${title}</span><button type="button" data-close>✕</button></header><div class="menu-body">${body}</div></div>`;

/** The pod: the start floor, then each clone at home with its send button (greyed when it can't go: injured, a raid due). */
export function podPanelHtml(p: WorldParty, floor: number, kept?: number): string {
  const floors = kept ? '' : startFloors(p).length > 1 ? `<div class="menu-row">${startFloors(p).map((f) => `<button type="button" data-floor="${f}" class="${f === floor ? 'on' : ''}">${f}층</button>`).join('')}</div>` : '';
  const rows = living(p).map((u) => {
    const ok = canDrill(p, u.id);
    return `<div class="menu-row"><span>${name(u)} · 레벨 ${u.level ?? 1}${u.injured ? ' · 부상' : ''}</span><button type="button" data-send="${u.id}" ${ok ? '' : 'disabled'}>보내기</button></div>`;
  }).join('');
  const fix = podRepairCost(p);
  const pod = `<div class="menu-row"><span>포드 ${Math.round(p.podHp)}/${POD_MAX}</span>${fix ? `<button type="button" data-podrepair ${p.ore >= fix ? '' : 'disabled'}>수리 · 광석 ${fix}</button>` : ''}</div>`;
  const ship = (Object.keys(SUPPORT) as SupportId[]).map((id) => {
    const s = SUPPORT[id], open = !!p.support?.[id];
    return `<div class="menu-row"><span>${s.name}</span>${open ? '<small>함선 지원 대기</small>' : `<button type="button" data-unlock="${id}" ${p.ore >= s.cost[0] && p.crystal >= s.cost[1] ? '' : 'disabled'}>열기 · 광석 ${s.cost[0]} · 마정석 ${s.cost[1]}</button>`}</div>`;
  }).join('');
  return frame('포드', `<p class="base-sub">${kept ? `▼ ${kept}층 복귀` : '▼ 지하로'}</p>${floors}${rows}${pod}${ship}`);
}

/** The lab: print a body (bio-matter permitting), put carried souls into fresh bodies, the workshop. */
export function labPanelHtml(p: WorldParty): string {
  const full = living(p).length >= MAX_CLONES;
  const print = `<div class="menu-row"><span>${full ? `클론 ${living(p).length}/${MAX_CLONES}` : `클론 생성 · 생체 ${p.bio}/${BODY_COST}`}</span><button type="button" data-print ${canPrintClone(p) ? '' : 'disabled'}>생성</button></div>`;
  const takers = living(p).filter((u) => canTakeSoul(p, u));
  const souls = p.carried.map((s, i) => `<div class="menu-row"><span>영혼 · ${CLASSES[typeof s === 'string' ? s : s.cls].name}</span>${takers.map((u) => `<button type="button" data-implant="${u.id}:${i}">${name(u)}에 주입</button>`).join('') || '<small>빈 몸 없음</small>'}</div>`).join('');
  return frame('연구실', `${print}${souls}<div class="menu-row"><button type="button" data-bench>작업장</button></div>`);
}

/** A defence: its name and health. */
export function defencePanelHtml(p: WorldParty, id: string): string {
  const b = p.buildings.find((x) => x.id === id);
  if (!b) return '';
  const row = LEVELS[b.kind], lv = levelOfBuilding(b), next = row?.cost[lv - 1], fix = repairCost(b);
  const up = next ? `<button type="button" data-upgrade ${!b.broken && p.ore >= next[0] && p.crystal >= next[1] ? '' : 'disabled'}>${lv + 1}단계 · 광석 ${next[0]}${next[1] ? ` · 마정석 ${next[1]}` : ''}</button>` : '';
  const mend = fix ? `<button type="button" data-repair ${p.ore >= fix ? '' : 'disabled'}>수리 · 광석 ${fix}</button>` : '';
  return frame(BUILD_NAMES[b.kind], `<div class="menu-row"><span>${row ? `${lv}단계 · ` : ''}체력 ${b.hp}/${b.maxHp}${b.broken ? ' · 파손' : ''}</span></div><div class="menu-row">${up}${mend}</div>`);
}

/** The panel window over the base: shows one panel, routes its buttons. */
export class BasePanels {
  readonly el = document.createElement('div');
  private hit: PanelHit | null = null;
  private floor = 1;

  constructor(private readonly p: () => WorldParty, private readonly act: { send: (id: string, floor: number) => void; print: () => void; implant: (id: string, soul: number) => void; bench: () => void }, private readonly kept: () => number | undefined) {
    this.el.className = 'pip-win menu-win base-panel';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (e.target === this.el || t?.hasAttribute('data-close')) { this.close(); return; }
      if (!t) return;
      if (t.dataset.floor) this.floor = Number(t.dataset.floor);
      if (t.dataset.send) { this.close(); this.act.send(t.dataset.send, this.floor); return; }
      if (t.hasAttribute('data-print')) this.act.print();
      if (t.dataset.implant) { const [id, i] = t.dataset.implant.split(':'); this.act.implant(id!, Number(i)); }
      if (t.hasAttribute('data-bench')) { this.close(); this.act.bench(); return; }
      const p = this.p(), id = this.hit?.id;
      if (t.hasAttribute('data-upgrade') && id) upgradeBuilding(p, id);
      if (t.hasAttribute('data-repair') && id) repairBuilding(p, id);
      if (t.hasAttribute('data-podrepair')) repairPod(p);
      if (t.dataset.unlock) unlockSupport(p, t.dataset.unlock as SupportId);
      this.draw();
    });
  }

  get open(): boolean { return !this.el.hidden; }
  show(hit: PanelHit): void { this.hit = hit; this.floor = 1; this.el.hidden = false; this.draw(); }
  close(): void { this.el.hidden = true; this.hit = null; }
  draw(): void {
    const p = this.p(), h = this.hit;
    if (!h) return;
    this.el.innerHTML = h.kind === 'pod' ? podPanelHtml(p, this.floor, this.kept()) : h.kind === 'lab' ? labPanelHtml(p) : defencePanelHtml(p, h.id!);
    if (!this.el.innerHTML) this.close();
  }
}
