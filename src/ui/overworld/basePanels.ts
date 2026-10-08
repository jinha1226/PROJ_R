import { podRepairCost, POD_MAX, repairPod } from '../../sim/base/buildings';
import { canPrintClone } from '../../sim/base/cloner';
import { canUpgradeDrill, drillCost, startFloors, upgradeDrill } from '../../sim/base/drill';
import { same, type Cell, type GEvent } from '../../sim/grid/types';
import type { Unit } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { canDrill, type WorldParty } from '../../sim/overworld/worldSim';
import { BODY_COST, canTakeSoul, living, MAX_CLONES } from '../../sim/roam/roam';

/** what a tap on the base opens: the core (send a clone down, the lift, repairs), the lab (bodies, souls, the workshop) */
export interface PanelHit { kind: 'pod' | 'lab' }

/** The panel under a tapped cell (the lab's own cell, the core's four), else null. */
export function panelAt(p: WorldParty, c: Cell): PanelHit | null {
  if (p.cloner && same(c, p.cloner)) return { kind: 'lab' };
  if (p.drill && c.x >= p.drill.x && c.x <= p.drill.x + 1 && c.y >= p.drill.y && c.y <= p.drill.y + 1) return { kind: 'pod' };
  return null;
}

const name = (u: Unit) => CLASSES[u.cls!].name;
const frame = (title: string, body: string) => `<div class="pip-frame menu-frame base-frame"><header><span class="pip-title">${title}</span><button type="button" data-close>✕</button></header><div class="menu-body">${body}</div></div>`;

/** The core: the start floor, each clone at home with its send button (greyed when it can't go: injured, a raid due), the lift, repairs. */
export function podPanelHtml(p: WorldParty, floor: number, kept?: number): string {
  const floors = kept ? '' : startFloors(p).length > 1 ? `<div class="menu-row">${startFloors(p).map((f) => `<button type="button" data-floor="${f}" class="${f === floor ? 'on' : ''}">${f}층</button>`).join('')}</div>` : '';
  const rows = living(p).map((u) => {
    const ok = canDrill(p, u.id);
    return `<div class="menu-row"><span>${name(u)} · 레벨 ${u.level ?? 1}${u.injured ? ' · 부상' : ''}</span><button type="button" data-send="${u.id}" ${ok ? '' : 'disabled'}>보내기</button></div>`;
  }).join('');
  const fix = podRepairCost(p), next = drillCost(p.drillLevel + 1);
  const pod = `<div class="menu-row"><span>코어 ${Math.round(p.podHp)}/${POD_MAX}</span>${fix ? `<button type="button" data-podrepair ${p.ore >= fix ? '' : 'disabled'}>수리 · 광석 ${fix}</button>` : ''}</div>`;
  const lift = `<div class="menu-row"><span>승강기 ${p.drillLevel}단계 · 시작 층 ${startFloors(p).join(' ')}</span>${next ? `<button type="button" data-drill ${canUpgradeDrill(p) ? '' : 'disabled'}>강화 · 광석 ${next.ore}${next.crystal ? ` · 마정석 ${next.crystal}` : ''}</button>` : '<small>최대</small>'}</div>`;
  return frame('코어', `<p class="base-sub">${kept ? `▼ ${kept}층 복귀` : '▼ 지하로'}</p>${floors}${rows}${pod}${lift}`);
}

/** The lab: print a body (bio-matter permitting), put carried souls into fresh bodies, the workshop. */
export function labPanelHtml(p: WorldParty): string {
  const full = living(p).length >= MAX_CLONES;
  const print = `<div class="menu-row"><span>${full ? `클론 ${living(p).length}/${MAX_CLONES}` : `클론 생성 · 생체 ${p.bio}/${BODY_COST}`}</span><button type="button" data-print ${canPrintClone(p) ? '' : 'disabled'}>생성</button></div>`;
  const takers = living(p).filter((u) => canTakeSoul(p, u));
  const souls = p.carried.map((s, i) => `<div class="menu-row"><span>영혼 · ${CLASSES[typeof s === 'string' ? s : s.cls].name}</span>${takers.map((u) => `<button type="button" data-implant="${u.id}:${i}">${name(u)}에 주입</button>`).join('') || '<small>빈 몸 없음</small>'}</div>`).join('');
  return frame('연구실', `${print}${souls}<div class="menu-row"><button type="button" data-bench>작업장</button></div>`);
}

/** The panel window over the base: shows one panel, routes its buttons. */
export class BasePanels {
  readonly el = document.createElement('div');
  private hit: PanelHit | null = null;
  private floor = 1;

  constructor(private readonly p: () => WorldParty, private readonly act: { send: (id: string, floor: number) => void; print: () => void; implant: (id: string, soul: number) => void; bench: () => void; live: (ev: GEvent[]) => void }, private readonly kept: () => number | undefined) {
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
      const p = this.p();
      if (t.hasAttribute('data-podrepair')) repairPod(p);
      if (t.hasAttribute('data-drill')) { const ev: GEvent[] = []; if (upgradeDrill(p, ev)) this.act.live(ev); }
      this.draw();
    });
  }

  get open(): boolean { return !this.el.hidden; }
  show(hit: PanelHit): void { this.hit = hit; this.floor = 1; this.el.hidden = false; this.draw(); }
  close(): void { this.el.hidden = true; this.hit = null; }
  draw(): void {
    const p = this.p(), h = this.hit;
    if (!h) return;
    this.el.innerHTML = h.kind === 'pod' ? podPanelHtml(p, this.floor, this.kept()) : labPanelHtml(p);
  }
}
