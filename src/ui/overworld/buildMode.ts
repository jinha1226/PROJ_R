import { BUILDINGS, canPlace, footprint, place, recommendedLayout, type BuildingKind } from '../../sim/base/buildings';
import { canUpgradeDrill, drillCost, startFloors, upgradeDrill } from '../../sim/base/drill';
import type { Cell, GEvent } from '../../sim/grid/types';
import type { WorldParty } from '../../sim/overworld/worldSim';
import type { GridRuntime } from '../../view/grid/gridRuntime';
import { BaseView } from '../../view/overworld/baseView';

const INFO: Record<BuildingKind, [string, string]> = {
  watchtower: ['망루', '사거리 6 자동 사격 · 영역 확장'], wall: ['성벽', '길을 막음'], palisade: ['방책', '엄폐'],
  gate: ['성문', '아군만 통과'], infirmary: ['의무실', '귀환하면 완전 회복'], forge: ['대장간', '희생 효율 35%'],
};
const ORDER: BuildingKind[] = ['watchtower', 'wall', 'palisade', 'gate', 'infirmary', 'forge'];
/** wall-like tiles stay picked so a run can be laid tap after tap; the rest are placed once */
const RUN = new Set<BuildingKind>(['wall', 'palisade']);

const cost = (ore: number, crystal = 0, bio = 0): string => [ore ? `광석 ${ore}` : '', crystal ? `마정석 ${crystal}` : '', bio ? `재료 ${bio}` : ''].filter(Boolean).join(' · ');

/**
 * The surface's build mode: a panel (drill upgrades, buildings, the recommended layout), a preview on the field, placing
 * on click (on touch, a first tap previews and a second on the same cell builds), and the start-floor choice at the shaft.
 */
export class BuildMode {
  readonly el = document.createElement('div');
  readonly view: BaseView;
  kind: BuildingKind | null = null;
  private pending: Cell | null = null;
  private readonly floors = document.createElement('div');
  private pickFloor: ((f: number) => void) | null = null;

  constructor(private readonly p: () => WorldParty, private readonly live: (ev: GEvent[]) => void, base: string, private readonly onToggle: (open: boolean) => void) {
    this.view = new BaseView(base);
    this.el.className = 'build-panel';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
      if (!t) return;
      const k = t.dataset.b!;
      if (k === 'close') { this.close(); return; }
      if (k === 'drill') { const ev: GEvent[] = []; if (upgradeDrill(this.p(), ev)) this.live(ev); }
      else if (k === 'recommend') { for (const s of recommendedLayout(this.p())) place(this.p(), s.kind, s.at); }
      else { this.kind = this.kind === k ? null : (k as BuildingKind); this.pending = null; }
      this.draw();
    });
    this.floors.className = 'pip-win menu-win';
    this.floors.hidden = true;
    this.floors.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, f = t.closest<HTMLElement>('[data-floor]')?.dataset.floor;
      if (f || t === this.floors || t.closest('[data-close]')) { this.floors.hidden = true; if (f) this.pickFloor?.(Number(f)); }
    });
  }

  /** the panel and the floor chooser, for the screen to mount */
  get parts(): HTMLElement[] { return [this.el, this.floors]; }
  get open(): boolean { return !this.el.hidden; }
  get choosing(): boolean { return !this.floors.hidden; }

  toggle(): void { if (this.open) this.close(); else { this.el.hidden = false; this.onToggle(true); this.draw(); } }
  close(): void { if (!this.open) return; this.el.hidden = true; this.kind = null; this.pending = null; this.onToggle(false); }

  draw(): void {
    if (!this.open) return;
    const p = this.p(), next = drillCost(p.drillLevel + 1);
    const drill = `<div class="bp-drill"><b>시추기 ${p.drillLevel}단계</b><small>시작 층 ${startFloors(p).join(' · ')}</small>${next ? `<button type="button" data-b="drill" ${canUpgradeDrill(p) ? '' : 'disabled'}>업그레이드 <small>${cost(next.ore, next.crystal)}</small></button>` : '<small>최대</small>'}</div>`;
    const list = ORDER.map((k) => {
      const d = BUILDINGS[k], afford = p.ore >= d.ore && p.bio >= d.bio;
      return `<button type="button" data-b="${k}" class="${this.kind === k ? 'on' : ''}" ${afford ? '' : 'disabled'}><b>${INFO[k][0]}</b><small>${cost(d.ore, 0, d.bio)}</small><em>${INFO[k][1]}</em></button>`;
    }).join('');
    this.el.innerHTML = `<header><span>건설</span><small>광석 ${p.ore} · 마정석 ${p.crystal} · 재료 ${p.bio}</small><button type="button" data-b="close">✕</button></header>
      ${drill}<div class="bp-list">${list}</div><button type="button" data-b="recommend" class="bp-rec">추천 배치</button>
      <p class="bp-hint">${this.kind ? `${INFO[this.kind][0]} · 우리 땅에 놓기` : '건물을 고르세요'}</p>`;
  }

  /** A click on the field while a building is picked: places it (or, on touch, previews first). True when the click was used. */
  click(c: Cell, touch: boolean): boolean {
    if (!this.open || !this.kind) return false;
    if (touch && !(this.pending && this.pending.x === c.x && this.pending.y === c.y)) { this.pending = c; return true; }
    if (place(this.p(), this.kind, c)) { if (!RUN.has(this.kind)) this.kind = null; }
    this.pending = null;
    this.draw();
    return true;
  }

  /** The footprint under the cursor (or the pending tap), green where it may go. True while it owns the field's marks. */
  marks(rt: GridRuntime, hover: Cell | null): boolean {
    if (!this.open || !this.kind) return false;
    const at = this.pending ?? hover;
    rt.showPath(null);
    rt.showAim(at ? footprint(this.kind, at) : null, !!at && canPlace(this.p(), this.kind, at));
    return true;
  }

  update(): void { this.view.sync(this.p().buildings); }

  /** At the shaft with deeper starts open: ask which floor to begin on. */
  chooseFloor(floors: number[], pick: (f: number) => void): void {
    this.pickFloor = pick;
    this.floors.innerHTML = `<div class="pip-frame menu-frame"><header><span class="pip-title">시작 층</span><button type="button" data-close>✕</button></header><div class="menu-body"><div class="menu-row">${floors.map((f) => `<button type="button" data-floor="${f}">지하 ${f}층</button>`).join('')}</div></div></div>`;
    this.floors.hidden = false;
  }
}
