import { canUpgradeDrill, upgradeDrill } from '../../sim/base/drill';
import { destination, floorRows, FLOORS, type FloorRow } from '../../sim/base/floors';
import type { GEvent } from '../../sim/grid/types';
import { zoneOf } from '../../sim/grid/zones';
import { CLASSES } from '../../sim/party/partyDefs';
import { canDrill, type WorldParty } from '../../sim/overworld/worldSim';
import { POD_SOUTH } from '../../sim/overworld/worldGen';
import { living } from '../../sim/roam/roam';
import { floorTop, STRATA, StrataView } from '../../view/overworld/strataView';
import '../styles/floorSheet.css';

/** the camera over the base and before its cross-section: its tilt (radians), where on the screen the ground's edge lies (a share of its height) */
const OVER = { tilt: Math.PI / 4, edge: 0.8 }, SIDE = { tilt: (6 * Math.PI) / 180, edge: 0.3 };
/** the cross-section is seen this many cells tall, whatever the base's own zoom */
const SIDE_ZOOM = 26;
/** where the view's middle lies north of the pod's row (the horde's way down is round it), and how far the base's view pans to the side */
const AIM_NORTH = 4, PAN = 7;

/** What a floor's line says: its number and (on a zone's first floor) the zone; then what the lift does there, or its guardian. */
export function floorLine(r: FloorRow, dest: number, known: boolean): { name: string; tag: string } {
  const zone = r.floor === zoneOf(r.floor).first ? (known ? r.zone : '???') : '';
  const tag = r.kept ? '비컨 · 복귀' : r.stop ? (r.floor === dest ? '▼ 목적지' : '정류장') : r.next ? '연장 가능' : r.boss && r.reached ? (r.passed ? '수호자 격파' : '수호자') : '';
  return { name: `B${r.floor}${zone ? ` · ${zone}` : ''}`, tag };
}

/** What opens on a tapped floor: the clones that can be sent to it (a stop, or the floor a beacon keeps), or the lift's next stretch and its price. */
export function floorPopHtml(p: WorldParty, r: FloorRow, kept: number | undefined, able: boolean): string {
  if (r.next) return `<button type="button" data-drill ${canUpgradeDrill(p) ? '' : 'disabled'}>승강기 연장 · 광석 ${r.next.ore}${r.next.crystal ? ` · 마정석 ${r.next.crystal}` : ''}</button>`;
  if (!r.stop && !r.kept) return '';
  if (kept !== undefined && !r.kept) return `<span>비컨이 붙잡은 B${kept}부터</span>`;
  const keys = living(p).map((u) => `<button type="button" data-send="${u.id}" ${able && canDrill(p, u.id) ? '' : 'disabled'}>${CLASSES[u.cls!].name} ${u.level ?? 1}</button>`).join('');
  return `<span>${r.kept ? '복귀' : '보내기'}</span>${keys}`;
}

/** The floors' lines over the cut face (the face itself is painted in the scene: strataView.ts). */
export function floorsHtml(p: WorldParty, kept: number | undefined, sel: number, pop: number, able: boolean): string {
  const dest = destination(p, kept, sel), rows = floorRows(p, kept);
  return rows.map((r, i) => {
    const known = rows.some((o) => o.zoneId === r.zoneId && (o.reached || o.stop)), line = floorLine(r, dest, known);
    const cls = `fl-row${r.reached ? '' : ' dark'}${r.stop ? ' stop' : ''}${r.kept ? ' kept' : ''}${r.next ? ' next' : ''}${r.floor === dest ? ' sel' : ''}`;
    const open = pop === r.floor ? floorPopHtml(p, r, kept, able) : '';
    return `<div class="${cls}" data-floor="${r.floor}" style="--n:${i}"><span class="fl-name">${line.name}</span><span class="fl-tag">${line.tag}</span>${open ? `<div class="fl-pop">${open}</div>` : ''}</div>`;
  }).join('');
}

/**
 * The base seen cut open (spec 2026-10-09 §1, after Dome Keeper and Fallout Shelter). Over the base the ground ends just
 * south of the core and the top of what lies under it shows along the screen's foot. A push upward, or a tap on the core
 * or on that cut, and the view swings down to face it: the base in profile along the top, the floors below — a drag goes
 * deeper. A floor the lift stops at is tapped to send a clone there; the lift's next stop, to drive the shaft on to it.
 */
export class FloorSheet {
  readonly el = document.createElement('div');
  readonly view = new StrataView();
  open = false;
  /** how far the view has swung down (0 over the base → 1 facing the cut) */
  private k = 0;
  /** how deep the cross-section is scrolled (cells) */
  private scroll = 0;
  private sel = 0;
  /** the floor whose keys are out (0: none) */
  private pop = 0;
  private html = '';
  private on = false;
  private drag: { y: number; from: number; moved: number } | null = null;
  private dragged = false;
  /** the screen's height and how many cells of it are seen (for the drag) */
  private h = 1; private tall = SIDE_ZOOM;

  constructor(private readonly p: () => WorldParty, private readonly act: { send: (id: string, floor: number) => void; live: (ev: GEvent[]) => void; able: () => boolean }, private readonly kept: () => number | undefined) {
    this.el.className = 'strata'; this.el.hidden = true;
    this.el.addEventListener('pointerdown', (e) => { this.drag = { y: e.clientY, from: this.scroll, moved: 0 }; this.dragged = false; });
    this.el.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || !this.open) return;
      d.moved = e.clientY - d.y;
      if (Math.abs(d.moved) > 6) { this.dragged = true; this.scroll = d.from - (d.moved * this.tall) / this.h; }
    });
    const up = () => { const d = this.drag; this.drag = null; if (d && this.dragged && d.from <= 0.01 && d.moved > 70) this.close(); };
    this.el.addEventListener('pointerup', up); this.el.addEventListener('pointercancel', up);
    this.el.addEventListener('wheel', (e) => { if (this.open) { e.preventDefault(); this.scroll += e.deltaY * 0.012; } }, { passive: false });
    this.el.addEventListener('click', (e) => {
      if (this.dragged) { this.dragged = false; return; }
      const t = e.target as HTMLElement, b = t.closest<HTMLElement>('button'), row = t.closest<HTMLElement>('.fl-row');
      const p = this.p(), kept = this.kept();
      if (b?.dataset.send) { const id = b.dataset.send, floor = destination(p, kept, this.sel); this.close(); this.act.send(id, floor); return; }
      if (b?.hasAttribute('data-drill')) { const ev: GEvent[] = []; if (upgradeDrill(p, ev)) { this.act.live(ev); this.pop = 0; } return; }
      // above the ground: back up over the base
      if (!row) { this.close(); return; }
      const n = Number(row.dataset.floor), r = floorRows(p, kept)[n - 1]!;
      if (r.stop && kept === undefined) this.sel = n;
      this.pop = this.pop === n || !(r.stop || r.kept || r.next) ? 0 : n;
    });
  }

  close(): void { this.open = false; this.pop = 0; }
  toggle(): void { if (this.open) this.close(); else this.open = true; }

  /** A push upward on the base's picture swings the view down to the cut. */
  attach(stage: HTMLElement): void {
    let at: { x: number; y: number } | null = null;
    stage.addEventListener('pointerdown', (e) => { at = e.isPrimary ? { x: e.clientX, y: e.clientY } : null; });
    stage.addEventListener('pointerup', (e) => {
      const dx = at ? e.clientX - at.x : 0, dy = at ? e.clientY - at.y : 0;
      at = null;
      if (this.on && !this.open && dy < -70 && -dy > Math.abs(dx) * 1.5) this.open = true;
    });
  }

  /**
   * A frame at the base: the view swings between its two places (its tilt, its zoom and where the ground's edge lies on
   * the screen all go together), the land is drawn no farther south than the cut, the floors' lines are laid over the face.
   * Returns how far the view has swung down (0 → 1).
   */
  frame(dt: number, on: boolean, rt: { setZoom(h: number): void; cutSouth(z: number | null): void; tilt: { elevation: number; y: number } | null } | null, cam: { aim: { x: number; y: number } }, h: number, zoom: number): number {
    this.el.hidden = !on;
    const root = this.el.parentElement;
    if (!rt || !root) return 0;
    if (on !== this.on) { this.on = on; if (!on) { rt.tilt = null; rt.cutSouth(null); this.open = false; this.k = 0; root.classList.remove('under'); } }
    if (!on || !h) return 0;
    const p = this.p(), kept = this.kept(), goal = this.open ? 1 : 0;
    this.k += (goal - this.k) * Math.min(1, dt * 7);
    if (Math.abs(goal - this.k) < 0.003) this.k = goal;
    const s = this.k * this.k * (3 - 2 * this.k), mix = (a: number, b: number) => a + (b - a) * s;
    const tilt = mix(OVER.tilt, SIDE.tilt), tall = mix(zoom, SIDE_ZOOM), edge = mix(OVER.edge, SIDE.edge);
    const cx = p.base.x + 0.5, cutZ = p.base.y + POD_SOUTH + 0.5, aimZ = p.base.y - AIM_NORTH;
    this.scroll = Math.max(0, Math.min(Math.max(0, floorTop(FLOORS + 1) + 1 - SIDE_ZOOM * (1 - SIDE.edge)), this.open || this.k > 0 ? this.scroll : 0));
    // (a point d cells south of the view's middle and y above it is drawn d·sin(tilt) − y·cos(tilt) cells below the screen's middle)
    const lookY = ((edge - 0.5) * tall - (cutZ - aimZ) * Math.sin(tilt)) / Math.cos(tilt) - this.scroll * s;
    rt.setZoom(tall); rt.tilt = { elevation: tilt, y: lookY }; rt.cutSouth(cutZ);
    cam.aim.y = aimZ;
    cam.aim.x = mix(Math.max(cx - PAN, Math.min(cx + PAN, cam.aim.x)), cx);
    this.h = h; this.tall = tall;
    const dest = destination(p, kept, this.sel);
    this.view.sync(cx, cutZ - 0.02, floorRows(p, kept), dest);
    // the floors' lines: where the first floor's ceiling is drawn, and how tall a floor is, on the screen
    const per = (h / tall) * Math.cos(tilt), y0 = h / 2 + ((cutZ - aimZ) * Math.sin(tilt) + (floorTop(1) + lookY) * Math.cos(tilt)) * (h / tall);
    this.el.style.setProperty('--y0', `${y0.toFixed(1)}px`); this.el.style.setProperty('--fh', `${(STRATA.floor * per).toFixed(2)}px`);
    this.el.style.opacity = String(Math.max(0, s * 2 - 1));
    const live = this.open && this.k > 0.9;
    this.el.classList.toggle('open', live); root.classList.toggle('under', this.open);
    const html = floorsHtml(p, kept, this.sel, this.pop, this.act.able());
    if (html !== this.html) { this.html = html; this.el.innerHTML = html; }
    return s;
  }
}
