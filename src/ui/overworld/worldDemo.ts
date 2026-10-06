import * as THREE from 'three';
import type { Screen } from '../../app/router';
import { GridSim } from '../../sim/grid/gridSim';
import { findPath } from '../../sim/grid/path';
import { idx, same, walkable, tileAt, type GEvent } from '../../sim/grid/types';
import { entOf, unitOf } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { promote } from '../../sim/party/partySim';
import { queueSkill } from '../../sim/party/partySkills';
import { canDrill, claimedShare, clones, newWorld, orderTo, worldTick, type WorldParty } from '../../sim/overworld/worldSim';
import { takeParty, type Carry } from '../../sim/roam/carry';
import { BODY_COST } from '../../sim/roam/roam';
import { GridRuntime } from '../../view/grid/gridRuntime';
import { LOOK_BY_ID } from '../../view/grid/gridActors';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import { PipWindow } from './pipWindow';
import { TraitPicker } from './traitPicker';
import { TouchPad } from './touchPad';
import { pickTrait } from '../../sim/party/partyLevel';
import type { TraitId } from '../../sim/party/partyTraits';
import { WorldHud } from './worldHud';
import { WorldLog } from './worldLog';
import { Pinch, coarsePointer, startZoom } from './touchView';
import { lookOf } from '../party/partyPick';
import { WorldMinimap } from './worldMinimap';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/partyDemo.css';
import '../styles/worldDemo.css';
import '../styles/worldHud.css';

/** game time per real second at normal speed */
const RATE = 3.6;
/** figures animate at most this much faster (a quicker game just covers more ground per second) */
const SHOW_MAX = 2;
const SPEEDS = [1, 2, 4];

/** `?demo=world`: an empty clone wakes by the crashed ship, finds souls that give it a class (more souls carried home become new clones), and the party takes the land round the goblin camps — in real time, pause any time. */
export class WorldDemo implements Screen {
  private readonly el = document.createElement('div');
  private stage!: HTMLElement;
  private rt: GridRuntime | null = null;
  private p!: WorldParty;
  private mini: WorldMinimap | null = null;
  private sel = 'hero';
  private paused = false;
  private speed = 1;
  private zoom = 14;
  private warned = new Set<string>();
  private hud!: WorldHud;
  private pip!: PipWindow;
  private picker!: TraitPicker;
  private pad!: TouchPad;
  private pausedBeforePip = false;
  private hover: { x: number; y: number } | null = null;
  private landing = false;
  private log = new WorldLog();
  private raf = 0;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);
  private pinch!: Pinch;

  private readonly seed: number;

  /**
   * opts.party: an expedition's surface (kept between trips); landing: the pod falls in first; onDrill: the party goes down the shaft;
   * restart: the expedition starts over (else the demo makes a new world).
   */
  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit, private readonly opts: { seed?: number; quit?: () => void; party?: WorldParty; landing?: boolean; onDrill?: (c: Carry) => void; restart?: () => void } = {}) {
    this.seed = opts.seed ?? (Number(new URLSearchParams(location.search).get('seed')) || 1);
  }

  mount(root: HTMLElement): void {
    this.el.className = 'screen grid landscape party world';
    this.el.innerHTML = '<div class="grid-stage"></div><div class="pd-labels"></div><div class="pd-pause">일시정지</div>';
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    this.hud = new WorldHud(this.el, {
      pause: () => { this.paused = !this.paused; },
      speed: () => { this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]!; this.pace(); },
      stat: () => this.togglePip('stat'), bag: () => this.togglePip('bag'),
      restart: () => (this.opts.restart ? this.opts.restart() : this.restart()), quit: this.opts.quit,
      ...(this.opts.onDrill ? { descend: () => { if (canDrill(this.p)) this.opts.onDrill!(takeParty(this.p)); }, descendLabel: '▼ 시추공' } : {}),
      select: (id) => this.select(id),
      skill: (id, slot) => queueSkill(this.p, id || this.sel, slot),
      promote: () => this.live(promote(this.p, this.sel)),
      traits: (id) => { if (!this.pip.open && !this.picker.open && !this.picker.open) this.pausedBeforePip = this.paused; this.picker.show(id || this.sel); },
    });
    this.pip = new PipWindow(() => this.p, () => { this.paused = this.pausedBeforePip; });
    this.el.appendChild(this.pip.el);
    this.picker = new TraitPicker(() => this.p, (id, t) => this.live(pickTrait(this.p, id, t as TraitId)), () => { this.paused = this.pausedBeforePip; });
    this.el.appendChild(this.picker.el);
    this.pad = new TouchPad({ dir: (dx, dy) => this.nudge(dx, dy), attack: () => this.attackNearest(), wait: () => this.stop(), bag: () => this.togglePip('bag'), stat: () => this.togglePip('stat') });
    this.el.appendChild(this.pad.el);
    this.pinch = new Pinch(this.stage, () => this.zoom, (z) => { this.zoom = Math.min(26, Math.max(7, z)); this.rt?.setZoom(this.zoom); });
    this.zoom = startZoom(this.zoom);
    // a pointer-up that ends a pinch or a drag is not a click
    this.stage.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch' || this.pinch.tapped) this.click(e); });
    this.stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.hover = this.rt?.cellAt(e.clientX, e.clientY) ?? null; });
    this.stage.addEventListener('pointerleave', () => { this.hover = null; });
    this.stage.addEventListener('contextmenu', (e) => e.preventDefault());
    this.stage.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.min(26, Math.max(8, this.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); this.rt?.setZoom(this.zoom); }, { passive: false });
    addEventListener('keydown', this.onKey);
    // tests and screenshots reach in through this handle
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __world: WorldDemo }).__world = this;
    this.restart();
    let last = performance.now();
    const loop = (now: number) => {
      // a frame's timestamp can come just before the moment the loop began: never a step back in time
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      // while the pod falls in the world waits; then the clone steps out
      if (this.landing && !this.rt?.podLanding) { this.landing = false; this.rt?.actors.setVisible(this.p.leader ?? 'hero', true); this.hud.toast('착륙'); }
      if (!this.paused && !this.pip.open && !this.picker.open && !this.landing) {
        const t0 = this.p.time;
        this.live(worldTick(this.p, dt * RATE * this.speed), t0);
        this.autoPause();
      }
      this.pad.update(dt);
      this.rt?.update(dt * Math.min(this.speed, SHOW_MAX));
      this.marks();
      this.labels();
      this.el.classList.toggle('paused', this.paused && !this.pip.open && !this.picker.open);
      const taken = this.p.camps.filter((c) => c.cleared).length;
      this.hud.draw(this.p, this.ids(), this.sel, { paused: this.paused, speed: this.speed, log: this.log,
        area: `<div><span>영역</span><b>${Math.round(claimedShare(this.p) * 100)}%</b></div><div><span>진지</span><b>${taken}/${this.p.camps.length}</b></div><div><span>클론</span><b>${this.ids().length}/3</b></div><div class="bio${this.p.bio >= BODY_COST ? ' ok' : ''}"><span>재료</span><b>${this.p.bio}/${BODY_COST}</b></div>${this.p.carried.length ? `<div class="soul"><span>영혼</span><b>${this.p.carried.length}</b></div>` : ''}`,
        mode: this.p.combat ? '<b class="fight">전투</b>' : '<b>탐색</b>', keys: '클릭 이동 · 적 클릭 공격 · Q W 기술 · Space 정지 · 휠 확대', stairs: canDrill(this.p) });
      this.mini?.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  unmount(): void { removeEventListener('keydown', this.onKey); cancelAnimationFrame(this.raf); this.rt?.dispose(); this.el.remove(); }

  private live(ev: GEvent[], t0 = this.p.time): void {
    if (!ev.length) return;
    // a new body or a soul taken: the figure's look must be set before the view builds it again
    for (const e of ev) {
      if (e.type !== 'buff' || (e.text !== 'soul' && e.text !== 'print')) continue;
      const u = unitOf(this.p, e.dst!)!;
      LOOK_BY_ID.set(u.id, lookOf(u.cls!, u.weapon!));
      if (e.text === 'soul') this.rt?.actors.rebuild(u.id);
    }
    this.rt?.applyLive(ev, t0);
    this.log.read(this.p, ev);
    for (const e of ev) {
      if (e.type === 'wake') this.alert(`wake${e.text}`, Number(e.text) >= 200 ? '고블린 발견' : '진지 발견');
      if (e.type === 'buff' && e.text === 'claim') this.message(`영역 확보 · ${Math.round(claimedShare(this.p) * 100)}%`);
      if (e.type === 'levelUp') this.hud.toast(`${this.name(e.src!)} 레벨 ${e.amount}`);
      if (e.type === 'buff' && e.text === 'soul') this.message(`${this.name(e.dst!)} 영혼 깃듦`);
      if (e.type === 'buff' && e.text === 'print') { this.message(unitOf(this.p, e.dst!)!.cls === 'shell' ? '새 몸이 깨어남' : '클론 출력'); if (!entOf(this.p, this.sel)?.alive) this.select(e.dst!); }
      if (e.type === 'pickup' && unitOf(this.p, e.src!)!.cls !== 'shell' && this.p.carried.length) this.message('영혼 회수 · 우주선으로');
      if (e.type === 'drop') this.alert(`drop${e.src}`, '영혼 소멸');
      if (e.type === 'dead') this.message('전멸');
    }
  }

  private restart(): void {
    LOOK_BY_ID.clear();
    this.p = this.opts.party ?? newWorld(this.seed);
    for (const u of clones(this.p)) LOOK_BY_ID.set(u.id, lookOf(u.cls!, u.weapon!));
    this.warned.clear();
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.rt = new GridRuntime(this.stage, GridSim.fromState(this.p.s), this.lib, this.kit, coarsePointer(), undefined, { theme: 'world', look: this.p });
    this.rt.setZoom(this.zoom);
    this.rt.pixelated = false;
    this.pace();
    this.select(this.p.leader ?? 'hero');
    this.paused = false;
    this.message('');
    this.log = new WorldLog();
    this.log.add(this.p.time, this.p.pod ? (this.opts.landing ? '포드 착륙 · 영혼 없음' : '지상 복귀') : '복제 포드 개방 · 영혼 없음', 'warn');
    // the pod falls in: the clone waits inside until it is down
    if (this.opts.landing && this.rt.landPod()) { this.landing = true; this.rt.actors.setVisible(this.p.leader ?? 'hero', false); }
    this.mini = new WorldMinimap(this.p, (c) => this.walk(c));
    this.hud.minimapSlot.replaceChildren(this.mini.el);
  }

  private select(id: string): void { this.sel = id; if (this.rt) this.rt.focusId = id; }
  /** the living clones, in the order they were made (keys 1 2 3) */
  private ids(): string[] { return clones(this.p).filter((u) => entOf(this.p, u.id)?.alive).map((u) => u.id); }

  /** A hero falling low or falling, or a camp waking, stops the clock so the player can react. */
  private autoPause(): void {
    for (const id of this.ids()) {
      const e = entOf(this.p, id)!;
      if (e.hp < e.maxHp * 0.35) this.alert(`${id}:low${this.p.combat ? Math.floor(this.p.time / 60) : ''}`, `${this.name(id)} 위험`);
      else if (unitOf(this.p, id)!.promoteReady) this.alert(`${id}:promo`, `${this.name(id)} 전직 가능`);
    }
  }

  private alert(key: string, text: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.paused = true;
    this.message(text);
  }

  private name(id: string): string { return CLASSES[unitOf(this.p, id)!.cls!].name; }
  private message(text: string): void { if (text) this.hud.toast(text); }
  /** Walk speed in cells per second of shown time: units step about every 0.85 of game time, and the show runs at min(speed, SHOW_MAX). */
  private pace(): void { this.rt?.setWalkSpeed((RATE * this.speed) / 0.85 / Math.min(this.speed, SHOW_MAX)); }

  private key(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === 'escape') { this.pip.close(); this.picker.close(); return; }
    if (this.picker.open) return;
    if (k === 'c' || k === 'i') { this.togglePip(k === 'c' ? 'stat' : 'bag'); return; }
    if (this.pip.open) return;
    if (k === ' ') { e.preventDefault(); this.paused = !this.paused; }
    const pick = this.ids()[Number(k) - 1];
    if ((k === '1' || k === '2' || k === '3') && pick) this.select(pick);
    if (k === 'q') queueSkill(this.p, this.sel, 0);
    if (k === 'w') queueSkill(this.p, this.sel, 1);
    if (k === 'r') this.restart();
  }

  /** A walk toward a cell, seen or not (the minimap uses it too). */
  private walk(c: { x: number; y: number }): void {
    // into the dark is fine (that is exploring); a tree or rock means the nearest open cell by it
    const m = this.p.s.map;
    for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(tileAt(m, n))) { orderTo(this.p, this.sel, n); return; }
    }
  }

  /** On a hero: select it. Otherwise a foe is the chosen hero's target, a cell the place to go. */
  private click(e: PointerEvent): void {
    const c = this.rt?.cellAt(e.clientX, e.clientY);
    if (!c) return;
    const at = this.unitAt(c);
    if (at?.side === 'hero') { this.select(at.id); return; }
    if (!entOf(this.p, this.sel)?.alive) this.select(this.p.leader ?? 'hero');
    const me = unitOf(this.p, this.sel);
    if (!me || !entOf(this.p, me.id)?.alive) return;
    if (at) me.order = { kind: 'attack', target: at.id };
    else this.walk(c);
  }

  private marks(): void {
    if (!this.rt) return;
    const me = unitOf(this.p, this.sel);
    const e = me && entOf(this.p, me.id);
    const o = me?.order;
    this.rt.showAim(e?.alive ? [e.pos, ...(o?.kind === 'move' || o?.kind === 'hold' ? [o.cell] : [])] : null, true);
    // the mouse over a seen open cell shows the walk a click would take (as in Jupiter Hell); otherwise the walk under way
    const h = this.hover, m = this.p.s.map;
    const hoverWalk = h && e?.alive && this.p.s.seen[idx(m, h)] && walkable(tileAt(m, h)) && !same(h, e.pos) && !this.unitAt(h) ? findPath(m, e.pos, h) : null;
    this.rt.showPath(hoverWalk ?? (o?.kind === 'move' && e?.alive ? findPath(m, e.pos, o.cell) : null));
  }

  private labels(): void {
    if (!this.rt) return;
    this.el.querySelector('.pd-labels')!.innerHTML = this.p.units.filter((u) => u.side === 'hero' && entOf(this.p, u.id)?.alive).map((u) => {
      const e = entOf(this.p, u.id)!;
      const pt = this.rt!.project(new THREE.Vector3(e.pos.x, 2.3, e.pos.y));
      return `<div class="pd-label${u.id === this.sel ? ' on' : ''}" style="left:${pt.left}px;top:${pt.top}px">${this.ids().indexOf(u.id) + 1} ${CLASSES[u.cls!].name}${u.order?.kind === 'hold' ? ' ▣' : ''}</div>`;
    }).join('');
  }

  /** The Pip-Boy window (the game waits while it is open, and goes on as it was). */
  private togglePip(tab: 'stat' | 'bag'): void {
    if (!this.pip.open && !this.picker.open) this.pausedBeforePip = this.paused;
    this.pip.toggle(tab, this.sel);
  }

  /** The stick: a short walk that way (the party follows out of a fight). */
  private nudge(dx: number, dy: number): void {
    const e = entOf(this.p, this.sel);
    if (!e?.alive || this.pip.open || this.picker.open) return;
    const c = { x: e.pos.x + dx, y: e.pos.y + dy };
    if (walkable(tileAt(this.p.s.map, c)) && !this.unitAt(c)) orderTo(this.p, this.sel, c);
  }

  /** The nearest foe in sight becomes the chosen clone's target. */
  private attackNearest(): void {
    const e = entOf(this.p, this.sel);
    if (!e?.alive) return;
    const d = (id: string) => Math.hypot(entOf(this.p, id)!.pos.x - e.pos.x, entOf(this.p, id)!.pos.y - e.pos.y);
    const foe = this.p.units.filter((u) => u.side === 'foe' && !u.asleep && entOf(this.p, u.id)?.alive && this.p.s.visible.has(idx(this.p.s.map, entOf(this.p, u.id)!.pos))).sort((a, b) => d(a.id) - d(b.id))[0];
    if (foe) unitOf(this.p, this.sel)!.order = { kind: 'attack', target: foe.id };
  }

  /** Stop where it stands (holding the spot in a fight). */
  private stop(): void {
    const u = unitOf(this.p, this.sel), e = entOf(this.p, this.sel);
    if (u && e?.alive) u.order = this.p.combat ? { kind: 'hold', cell: { ...e.pos } } : null;
  }

  /** a living unit the party can see on that cell */
  private unitAt(c: { x: number; y: number }) { return this.p.units.find((u) => entOf(this.p, u.id)?.alive && same(entOf(this.p, u.id)!.pos, c) && this.p.s.visible.has(idx(this.p.s.map, c))); }
}
