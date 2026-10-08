import { barricadeCap, buildingsAt, canPlace, pickUp, place } from '../../sim/base/buildings';
import { canPost, setPost } from '../../sim/base/posts';
import { same, type Cell, type GEvent } from '../../sim/grid/types';
import { alive, entOf, stats, unitOf } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { living } from '../../sim/roam/roam';
import type { GridRuntime } from '../../view/grid/gridRuntime';
import { BaseView } from '../../view/overworld/baseView';
import '../styles/baseHud.css';

/** the two things done to the base's ground by day: laying barricades, giving the clones their posts */
export type BaseTool = 'wall' | 'post';

/** the letter a clone's post is marked with (MODEL W → W) */
export const postLetter = (p: WorldParty, id: string): string => CLASSES[unitOf(p, id)?.cls ?? 'shell'].name.slice(-1);

/** The line over the base keys: what the tool in hand does and how much of it is left. */
export function toolHint(p: WorldParty, tool: BaseTool | null, picked: string | null): string {
  if (tool === 'wall') return `<b>바리케이드 ${p.buildings.length}/${barricadeCap(p)}</b><span>땅을 눌러 놓고 · 다시 눌러 거둔다</span>`;
  if (tool !== 'post') return '';
  const u = picked ? unitOf(p, picked) : undefined;
  if (!u) return '<b>자리</b><span>클론을 누르고 · 설 칸을 누른다</span>';
  const r = stats(u, p.time, p).range;
  return `<b>${CLASSES[u.cls!].name}</b><span>${r > 1 ? `사거리 ${r}` : '근접'} · 설 칸을 누른다${u.post ? ' · 제 자리를 누르면 해제' : ''}</span>`;
}

/**
 * The base's ground by day (spec 2026-10-09 §2.1): with the barricade tool a tap lays one or takes one up; with the post tool
 * a tap on a clone picks it and a tap on a cell is where it will stand at night. Also the start-floor choice at the shaft.
 */
export class BaseTools {
  readonly el = document.createElement('div');
  readonly view: BaseView;
  tool: BaseTool | null = null;
  /** the clone whose post is being chosen */
  picked: string | null = null;
  private html = '';
  private readonly floors = document.createElement('div');
  private pickFloor: ((f: number) => void) | null = null;

  constructor(private readonly p: () => WorldParty, private readonly say: (text: string) => void, private readonly live: (ev: GEvent[]) => void) {
    this.view = new BaseView();
    this.el.className = 'base-hint';
    this.el.hidden = true;
    this.floors.className = 'pip-win menu-win';
    this.floors.hidden = true;
    this.floors.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, f = t.closest<HTMLElement>('[data-floor]')?.dataset.floor;
      if (f || t === this.floors || t.closest('[data-close]')) { this.floors.hidden = true; if (f) this.pickFloor?.(Number(f)); }
    });
  }

  /** the hint line and the floor chooser, for the screen to mount */
  get parts(): HTMLElement[] { return [this.el, this.floors]; }
  get open(): boolean { return this.tool !== null; }
  get choosing(): boolean { return !this.floors.hidden; }

  /** Takes a tool in hand (the same one again puts it down). */
  pick(tool: BaseTool): void { this.tool = this.tool === tool ? null : tool; this.picked = null; }
  close(): void { this.tool = null; this.picked = null; }

  /** A tap on the base's ground with a tool in hand (`figure`: the clone whose figure the tap landed on, if any). True when the tap was the tool's. */
  click(c: Cell, figure?: string): boolean {
    const p = this.p();
    if (!this.tool || p.raid) return false;
    if (this.tool === 'wall') {
      const b = buildingsAt(p, c), ev: GEvent[] = [];
      if (b) pickUp(p, b.id);
      else if (place(p, c, ev)) this.live(ev);
      else this.say(p.buildings.length >= barricadeCap(p) ? '바리케이드가 없다' : '놓을 수 없는 자리');
      return true;
    }
    const who = living(p).find((u) => u.id === figure) ?? living(p).find((u) => same(entOf(p, u.id)!.pos, c)) ?? (this.picked ? undefined : living(p).find((u) => u.post && same(u.post, c)));
    if (who && who.id !== this.picked) { this.picked = who.id; return true; }
    if (!this.picked) return true;
    if (!setPost(p, this.picked, c)) this.say('설 수 없는 자리');
    return true;
  }

  /** The tool's marks on the field: the cell under the cursor (green where it would work), the picked clone's reach. True while it owns the marks. */
  marks(rt: GridRuntime, hover: Cell | null): boolean {
    const p = this.p();
    if (!this.tool || p.raid) { rt.showReach(null, 0); return false; }
    rt.showPath(null);
    if (this.tool === 'wall') { rt.showReach(null, 0); rt.showAim(hover ? [hover] : null, !!hover && (!!buildingsAt(p, hover) || canPlace(p, hover))); return true; }
    const u = this.picked ? unitOf(p, this.picked) : undefined;
    if (!u || !alive(p, u)) { this.picked = null; rt.showAim(null, true); rt.showReach(null, 0); return true; }
    // the reach is drawn from where the clone would stand: the cell pointed at, else its post, else where it is now
    const ok = !!hover && canPost(p, u.id, hover), from = (ok ? hover : null) ?? u.post ?? entOf(p, u.id)!.pos;
    rt.showAim(hover ? [hover] : null, ok);
    rt.showReach(from, Math.max(1, stats(u, p.time, p).range));
    return true;
  }

  update(): void {
    const p = this.p();
    this.view.sync(p.buildings);
    const html = p.raid ? '' : toolHint(p, this.tool, this.picked);
    if (html !== this.html) { this.html = html; this.el.innerHTML = html; this.el.hidden = !html; }
  }

  /** At the shaft with deeper starts open: ask which floor to begin on. */
  chooseFloor(floors: number[], pick: (f: number) => void): void {
    this.pickFloor = pick;
    this.floors.innerHTML = `<div class="pip-frame menu-frame"><header><span class="pip-title">시작 층</span><button type="button" data-close>✕</button></header><div class="menu-body"><div class="menu-row">${floors.map((f) => `<button type="button" data-floor="${f}">지하 ${f}층</button>`).join('')}</div></div></div>`;
    this.floors.hidden = false;
  }
}
