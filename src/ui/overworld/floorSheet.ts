import * as THREE from 'three';
import { canUpgradeDrill, drillCost, LIFT_STOPS, startFloors, upgradeDrill } from '../../sim/base/drill';
import type { GEvent } from '../../sim/grid/types';
import { isBossFloor, zoneOf } from '../../sim/grid/zones';
import { CLASSES } from '../../sim/party/partyDefs';
import { canDrill, type WorldParty } from '../../sim/overworld/worldSim';
import { living } from '../../sim/roam/roam';
import '../styles/floorSheet.css';

export const FLOORS = 15;
/** the sheet's measures on the screen (px): a floor's row, the ground's lip, the send keys' foot, the room kept for the keys along the bottom */
const ROW = 30, LIP = 22, FOOT = 50, MENU = 56;
/** how many floors peek from under the base while the sheet is shut */
const PEEK_ROWS = 4;
/** where the ground is cut, in cells south of the base's own cell (just past the core's feet); how much farther off the surface is seen with the sheet open; how far the view pans to the side */
const CUT_Z = 2.3, FAR = 0.55, PAN = 7;

/** One floor of the cross-section: what is known of it and what the lift does there. */
export interface FloorRow {
  floor: number; zone: string; zoneId: string;
  /** a clone has stood on it */
  reached: boolean;
  /** the lift stops here: a clone can be sent down to it */
  stop: boolean;
  /** the lift's next stop, and what the shaft down to it costs */
  next?: { ore: number; crystal: number };
  boss: boolean;
  /** a return beacon keeps this floor waiting */
  kept: boolean;
}

/** The floors under the base, top to bottom (`kept`: the floor a beacon keeps). */
export function floorRows(p: WorldParty, kept?: number): FloorRow[] {
  const stops = startFloors(p), nextStop = LIFT_STOPS[p.drillLevel + 1], cost = drillCost(p.drillLevel + 1);
  // (a base nobody has left yet has reached nothing, though its record starts at floor 1)
  const deepest = p.trips > 0 || kept !== undefined || p.deepest > 1 ? Math.max(p.deepest, kept ?? 0) : 0;
  return Array.from({ length: FLOORS }, (_, i) => {
    const floor = i + 1, z = zoneOf(floor);
    return { floor, zone: z.name, zoneId: z.id, reached: floor <= deepest, stop: stops.includes(floor), next: floor === nextStop && cost ? cost : undefined, boss: isBossFloor(floor), kept: floor === kept };
  });
}

/** where a clone sent now would go: the kept floor if one waits, else the chosen stop (the deepest stop when none is chosen) */
export const destination = (p: WorldParty, kept: number | undefined, sel: number): number => kept ?? (startFloors(p).includes(sel) ? sel : startFloors(p).at(-1)!);

/** The rows: number, what the floor is (its zone on the zone's first floor, its guardian on its last), then what the lift does there. */
export function floorsHtml(p: WorldParty, kept: number | undefined, sel: number): string {
  const dest = destination(p, kept, sel), rows = floorRows(p, kept);
  return rows.map((r) => {
    const known = r.reached || r.stop || rows.some((o) => o.zoneId === r.zoneId && (o.reached || o.stop));
    const what = r.floor === zoneOf(r.floor).first ? (known ? r.zone : '???') : r.boss ? (known ? '수호자' : '') : '';
    const tag = r.next ? `<button type="button" data-drill ${canUpgradeDrill(p) ? '' : 'disabled'}>연장 · 광석 ${r.next.ore}${r.next.crystal ? ` · 마정석 ${r.next.crystal}` : ''}</button>`
      : r.kept ? '비컨 · 복귀' : r.stop ? (r.floor === dest ? '▼ 목적지' : '정류장') : '';
    const cls = `fl-row z-${r.zoneId}${r.reached ? ' reached' : r.stop ? '' : ' dark'}${r.stop ? ' stop' : ''}${r.kept ? ' kept' : ''}${r.floor === dest ? ' sel' : ''}${r.boss ? ' boss' : ''}`;
    return `<div class="${cls}" data-floor="${r.floor}"><span class="fl-n">${String(r.floor).padStart(2, '0')}</span><span class="fl-what">${what}</span><span class="fl-tags">${tag}</span></div>`;
  }).join('');
}

/** The foot: where a clone would go, and a key for each clone at home that sends it there. */
export function sendHtml(p: WorldParty, kept: number | undefined, sel: number, able: boolean): string {
  const dest = destination(p, kept, sel);
  const keys = living(p).map((u) => `<button type="button" data-send="${u.id}" ${able && canDrill(p, u.id) ? '' : 'disabled'}>${CLASSES[u.cls!].name} ${u.level ?? 1}</button>`).join('');
  return `<span class="fl-dest">▼ ${dest}층${kept ? ' 복귀' : ''}</span>${keys}`;
}

/**
 * The ground under the base, cut open (spec 2026-10-09 §1: the base above, its floors below, as in Dome Keeper). Shut, a
 * few floors peek from under the base; opened — a tap or a push upward — the surface shrinks to a strip along the top (seen
 * from farther off, the fight going on) and every floor is laid out: where the lift stops, how deep anyone has been, the
 * floor a beacon keeps. A stop is tapped to choose it; a clone's key at the foot sends that clone there.
 */
export class FloorSheet {
  readonly el = document.createElement('div');
  open = false;
  /** how far open (0 shut → 1 open): the cut slides, it does not jump */
  private k = 0;
  private sel = 0;
  private html = ''; private foot = ''; private lip = '';
  private downY: number | null = null;
  private swiped = false;
  private vars = '';

  constructor(private readonly p: () => WorldParty, private readonly act: { send: (id: string, floor: number) => void; live: (ev: GEvent[]) => void; able: () => boolean }, private readonly kept: () => number | undefined) {
    this.el.className = 'strata'; this.el.hidden = true;
    this.el.innerHTML = '<div class="fl-lip"><span class="fl-deep"></span></div><div class="fl-list"><div class="fl-shaft"></div><div class="fl-rows"></div></div><div class="fl-foot"></div>';
    // a push upward opens it, a pull down (with the list at its top) shuts it
    this.el.addEventListener('pointerdown', (e) => { this.downY = e.clientY; this.swiped = false; });
    this.el.addEventListener('pointerup', (e) => {
      const dy = this.downY === null ? 0 : e.clientY - this.downY;
      this.downY = null;
      if (dy < -24 && !this.open) { this.open = true; this.swiped = true; }
      if (dy > 24 && this.open && this.el.querySelector('.fl-list')!.scrollTop <= 0) { this.open = false; this.swiped = true; }
    });
    this.el.addEventListener('click', (e) => {
      if (this.swiped) { this.swiped = false; return; }
      if (!this.open) { this.open = true; return; }
      const t = e.target as HTMLElement, b = t.closest<HTMLElement>('button'), row = t.closest<HTMLElement>('.fl-row');
      const p = this.p();
      if (b?.dataset.send) { const id = b.dataset.send, floor = destination(p, this.kept(), this.sel); this.open = false; this.act.send(id, floor); return; }
      if (b?.hasAttribute('data-drill')) { const ev: GEvent[] = []; if (upgradeDrill(p, ev)) this.act.live(ev); return; }
      if (row?.classList.contains('stop')) { this.sel = Number(row.dataset.floor); return; }
      if (t.closest('.fl-lip')) this.open = false;
    });
  }

  toggle(): void { this.open = !this.open; }

  /**
   * A frame at the base: the cut slides toward where it belongs, the view is held so the ground's edge under the core
   * meets it (the camera's height is the sheet's to set; it pans only sideways), the shaft is drawn under the core.
   */
  frame(dt: number, on: boolean, rt: { project(v: THREE.Vector3): { left: number; top: number }; setZoom(h: number): void } | null, cam: { aim: { x: number; y: number } }, h: number, zoom: number): void {
    this.el.hidden = !on;
    const root = this.el.parentElement;
    if (!on || !rt || !root || !h) return;
    const p = this.p(), goal = this.open ? 1 : 0;
    this.k += (goal - this.k) * Math.min(1, dt * 10);
    if (Math.abs(goal - this.k) < 0.004) this.k = goal;
    const peek = h - MENU - LIP - PEEK_ROWS * ROW, full = Math.max(h * 0.3, h - MENU - LIP - FOOT - FLOORS * ROW);
    const cut = Math.round(peek + (full - peek) * this.k), far = zoom * (1 + FAR * this.k);
    rt.setZoom(far);
    // (a point `d` cells south of the view's middle is drawn d · sin 45° · h / zoom px below the screen's middle)
    cam.aim.y = p.base.y + CUT_Z - (cut - h / 2) * (far / h) * Math.SQRT2;
    cam.aim.x = Math.max(p.base.x + 0.5 - PAN, Math.min(p.base.x + 0.5 + PAN, cam.aim.x));
    const shaft = Math.round(rt.project(new THREE.Vector3(p.base.x + 0.5, 0, p.base.y + 0.5)).left), vars = `${cut}:${shaft}:${this.open}`;
    if (vars !== this.vars) {
      this.vars = vars;
      root.style.setProperty('--cut', `${cut}px`);
      this.el.style.setProperty('--shaft', `${shaft}px`);
      this.el.classList.toggle('open', this.open); root.classList.toggle('under', this.open);
    }
    this.draw();
  }

  private draw(): void {
    const p = this.p(), kept = this.kept();
    const html = floorsHtml(p, kept, this.sel), foot = this.open ? sendHtml(p, kept, this.sel, this.act.able()) : '';
    const lip = `${p.trips > 0 || p.deepest > 1 || kept ? `최심 ${Math.max(p.deepest, kept ?? 0)}층` : '지하'} ${this.open ? '▼' : '▲'}`;
    if (html !== this.html) { this.html = html; this.el.querySelector('.fl-rows')!.innerHTML = html; this.el.style.setProperty('--stops', String(startFloors(p).at(-1))); }
    if (foot !== this.foot) { this.foot = foot; this.el.querySelector('.fl-foot')!.innerHTML = foot; }
    if (lip !== this.lip) { this.lip = lip; this.el.querySelector('.fl-deep')!.textContent = lip; }
  }
}
