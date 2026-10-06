import { loadDot, saveDot } from '../../app/gridPreferences';
import * as THREE from 'three';
import type { Screen } from '../../app/router';
import { GridSim } from '../../sim/grid/gridSim';
import { findPath } from '../../sim/grid/path';
import { dist, idx, same, walkable, tileAt, type Cell, type GEvent } from '../../sim/grid/types';
import { entOf, unitOf } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { cardTarget, targetCardHtml } from '../overworld/targetCard';
import { tapCell } from './tapCell';
import { MiningCue } from './miningCue';
import { PlacePrompts, type Prompt } from '../overworld/placePrompt';
import { command, promote } from '../../sim/party/partySim';
import { queueUltimate } from '../../sim/party/ultimate';
import { clones, orderTo } from '../../sim/roam/roam';
import { canAscend, canDescend, delveTick, descend, newDelve, type DelveParty } from '../../sim/delve/delveSim';
import { takeParty, type Carry } from '../../sim/roam/carry';
import { GridRuntime } from '../../view/grid/gridRuntime';
import { LOOK_BY_ID } from '../../view/grid/gridActors';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import { lookOf } from '../party/partyPick';
import { PipWindow, type PipTab } from '../overworld/pipWindow';
import { TraitPicker } from '../overworld/traitPicker';
import { OptionsMenu } from '../overworld/optionsMenu';
import { pickTrait } from '../../sim/party/partyLevel';
import type { TraitId } from '../../sim/party/traitDefs';
import { WorldHud } from '../overworld/worldHud';
import { WorldLog } from '../overworld/worldLog';
import { Pinch, coarsePointer, startZoom } from '../overworld/touchView';
import { DelveMinimap } from './delveMinimap';
import { DelveProps } from '../../view/delve/delveProps';
import { TouchPad } from '../overworld/touchPad';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/partyDemo.css';
import '../styles/worldHud.css';

/** game time per real second at normal speed */
const RATE = 3.6;
const SHOW_MAX = 2;
const SPEEDS = [1, 2, 4];
type Mode = 'turn' | 'realtime';
const MODE_KEY = 'projr.combatMode';
const savedMode = (): Mode => { try { return localStorage.getItem(MODE_KEY) === 'realtime' ? 'realtime' : 'turn'; } catch { return 'turn'; } };

/**
 * `?demo=delve`: the dungeon below the ship. Exploring runs in real time; when a band notices the party the fight turns
 * turn-based as in Jupiter Hell — time stops on the chosen clone's moment, the companions act by themselves (1 2 3 switches
 * which clone is under the hand). The fight can be set to real time with pause instead.
 */
export class DelveDemo implements Screen {
  private readonly el = document.createElement('div');
  private stage!: HTMLElement;
  private rt: GridRuntime | null = null;
  private p!: DelveParty;
  private hud!: WorldHud;
  private pip!: PipWindow;
  private picker!: TraitPicker;
  private menu!: OptionsMenu;
  private pad!: TouchPad;
  private props: DelveProps | null = null;
  private mini!: DelveMinimap;
  private log = new WorldLog();
  private sel = 'hero';
  private paused = false;
  private pausedBeforePip = false;
  private speed = 1;
  private zoom = 11;
  private mode: Mode = savedMode();
  private hover: Cell | null = null;
  private readonly miningCue = new MiningCue();
  private readonly prompts = new PlacePrompts();
  /** whether the last tick moved anyone (followers still catching up keep time going) */
  private movedLast = true;
  /** turn-based: a wait runs time on to here */
  private waitUntil = 0;
  private warned = new Set<string>();
  private slowUntil = 0;
  private raf = 0;
  private readonly seed: number;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);
  private pinch!: Pinch;

  /** opts.party: the floor the expedition's party came down to; onAscend: the party rides up to the pod (also when nobody is left); restart: the expedition starts over. */
  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit, private readonly opts: { seed?: number; quit?: () => void; party?: DelveParty; onAscend?: (c: Carry) => void; restart?: () => void } = {}) {
    this.seed = opts.seed ?? (Number(new URLSearchParams(location.search).get('seed')) || 1);
  }

  mount(root: HTMLElement): void {
    this.el.className = 'screen grid landscape party world delve';
    this.el.innerHTML = '<div class="grid-stage"></div><div class="pd-labels"></div><div class="pd-pause">일시정지</div>';
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    this.hud = new WorldHud(this.el, {
      menu: () => this.toggleMenu(),
      stat: () => this.togglePip('stat'), bag: () => this.togglePip('gear'),
      select: (id) => this.select(id),
      skill: (id) => this.skill(id || this.sel),
      promote: () => this.live(promote(this.p, this.sel)),
      traits: (id) => { if (!this.pip.open && !this.picker.open && !this.menu.open && !this.picker.open) this.pausedBeforePip = this.paused; this.picker.show(id || this.sel); },
      wait: () => { if (this.myTurn) this.live(command(this.p, { kind: 'wait' })); },
    });
    this.pip = new PipWindow(() => this.p, () => { this.paused = this.pausedBeforePip; }, (ev) => this.live(ev));
    this.el.appendChild(this.prompts.el);
    this.el.appendChild(this.pip.el);
    this.picker = new TraitPicker(() => this.p, (id, t) => this.live(pickTrait(this.p, id, t as TraitId)), () => { this.paused = this.pausedBeforePip; });
    this.el.appendChild(this.picker.el);
    this.menu = new OptionsMenu(() => ({ speed: this.speed, speeds: SPEEDS, turnBased: this.mode === 'turn', dot: this.rt?.pixelated ?? loadDot(), keys: '클릭 이동·공격 · Q W 기술 · Space 대기(턴제)/정지 · 1 2 3 조종 · C 상태 · I 가방 · 휠 확대' }), {
      speed: (v) => { this.speed = v; this.pace(); },
      mode: () => { this.mode = this.mode === 'turn' ? 'realtime' : 'turn'; try { localStorage.setItem(MODE_KEY, this.mode); } catch { /* private window */ } },
      dot: () => { if (!this.rt) return; this.rt.pixelated = !this.rt.pixelated; saveDot(this.rt.pixelated); },
      pip: (tab) => this.togglePip(tab),
      restart: () => (this.opts.restart ? this.opts.restart() : this.restart()), quit: this.opts.quit,
      close: () => { this.paused = this.pausedBeforePip; },
    });
    this.el.appendChild(this.menu.el);
    this.pad = new TouchPad({ dir: (dx, dy) => this.nudge(dx, dy), attack: () => this.attackNearest(), wait: () => this.waitOrStop(), bag: () => this.togglePip('gear'), stat: () => this.togglePip('stat'), tap: (x, y) => this.click({ clientX: x, clientY: y } as PointerEvent) });
    this.el.appendChild(this.pad.el);
    this.mini = new DelveMinimap(() => this.p);
    this.hud.minimapSlot.replaceChildren(this.mini.el);
    this.pinch = new Pinch(this.stage, () => this.zoom, (z) => { this.zoom = Math.min(26, Math.max(7, z)); this.rt?.setZoom(this.zoom); });
    this.zoom = startZoom(this.zoom);
    // a pointer-up that ends a pinch or a drag is not a click
    this.stage.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch' || this.pinch.tapped) this.click(e); });
    this.stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.hover = this.rt?.cellAt(e.clientX, e.clientY) ?? null; });
    this.stage.addEventListener('pointerleave', () => { this.hover = null; });
    this.stage.addEventListener('contextmenu', (e) => e.preventDefault());
    this.stage.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.min(20, Math.max(7, this.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); this.rt?.setZoom(this.zoom); }, { passive: false });
    addEventListener('keydown', this.onKey);
    // tests and screenshots reach in through this handle
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __delve: DelveDemo }).__delve = this;
    this.restart();
    let last = performance.now();
    const loop = (now: number) => {
      // a frame's timestamp can come just before the moment the loop began: never a step back in time
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      this.handOver();
      if (!this.paused && !this.pip.open && !this.picker.open && !this.menu.open && !this.p.waiting && !this.still()) {
        const t0 = this.p.time, slow = this.mode === 'realtime' && now < this.slowUntil ? 0.35 : 1;
        const ev = delveTick(this.p, dt * RATE * this.speed * slow);
        this.movedLast = ev.some((e) => e.type === 'move');
        this.live(ev, t0);
      }
      this.pad.update(dt);
      this.props?.update(dt);
      this.rt?.update(dt * Math.min(this.speed, SHOW_MAX));
      this.miningCue.update(this.p, this.rt);
      this.placePrompts();
      this.marks();
      this.labels();
      this.el.classList.toggle('paused', this.paused && !this.pip.open && !this.picker.open && !this.menu.open);
      this.drawHud();
      this.mini.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  unmount(): void { removeEventListener('keydown', this.onKey); cancelAnimationFrame(this.raf); this.rt?.dispose(); this.el.remove(); }

  /** In a turn-based fight the chosen clone is under the hand; out of a fight (or in real time) nobody is. */
  private handOver(): void {
    const hand = this.mode === 'turn' && this.p.combat && entOf(this.p, this.sel)?.alive ? this.sel : undefined;
    if (this.p.manual !== hand) { this.p.manual = hand; this.p.waiting = false; }
  }

  private get myTurn(): boolean { return !!this.p.waiting && this.p.manual === this.sel; }

  private live(ev: GEvent[], t0 = this.p.time): void {
    if (!ev.length) return;
    for (const e of ev) {
      if (e.type !== 'buff' || (e.text !== 'soul' && e.text !== 'print')) continue;
      const u = unitOf(this.p, e.dst!)!;
      LOOK_BY_ID.set(u.id, lookOf(u.cls!, u.weapon!));
      if (e.text === 'soul') this.rt?.actors.absorb(u.id);
    }
    this.rt?.applyLive(ev, t0);
    this.log.read(this.p, ev);
    for (const e of ev) {
      if (e.type === 'die' && unitOf(this.p, e.dst!)?.side === 'hero') this.alert(`dead${e.dst}`, `${this.name(e.dst!)} 쓰러짐`, this.mode === 'realtime');
      if (e.type === 'wake') this.alert(`wake${this.p.floor}:${e.text}`, '적 발견', this.mode === 'realtime');
      if (e.type === 'telegraph' && e.to) { this.props?.slam(e.to, e.amount ?? 2); this.hud.toast('내려찍기!'); }
      if (e.type === 'victory') this.hud.toast('마왕군 장군 처치');
      if (e.type === 'levelUp') this.hud.toast(`${this.name(e.src!)} 레벨 ${e.amount}`);
      if (e.type === 'buff' && e.text === 'soul') this.hud.toast(`${this.name(e.dst!)} 영혼 깃듦`);
      if (e.type === 'buff' && e.text === 'print') { this.hud.toast(unitOf(this.p, e.dst!)!.cls === 'shell' ? '새 몸이 깨어남' : '클론 출력'); if (!entOf(this.p, this.sel)?.alive) this.select(e.dst!); }
      if (e.type === 'drop') this.hud.toast('영혼 소멸');
      if (e.type === 'dead') {
        this.hud.toast('전멸');
        this.log.add(e.t, e.text === 'lost' ? '전멸 · 영혼은 지하에 남음' : '전멸 · 재료 부족', 'warn');
        // below ground nobody comes back on their own: the pod takes it from here
        if (e.text === 'lost' && this.opts.onAscend) setTimeout(() => this.opts.onAscend!(takeParty(this.p)), 2200);
      }
      // in real time a clone falling low slows the world for a moment instead of stopping it
      if (e.type === 'hit' && this.mode === 'realtime' && unitOf(this.p, e.dst!)?.side === 'hero') {
        const h = entOf(this.p, e.dst!)!;
        if (h.alive && h.hp < h.maxHp * 0.35) this.slowUntil = performance.now() + 2500;
      }
    }
  }

  private alert(key: string, text: string, stop: boolean): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    if (stop) this.paused = true;
    this.hud.toast(text);
  }

  private restart(): void {
    this.p = this.opts.party ?? newDelve(this.seed);
    this.warned.clear();
    this.log = new WorldLog();
    this.log.add(this.p.time, `${this.opts.party ? '시추공 하강' : '승강기 하강'} · 지하 ${this.p.floor}층`, 'warn');
    LOOK_BY_ID.clear();
    this.view();
    this.select(this.p.leader ?? 'hero');
    this.paused = false;
  }

  /** The floor's view (built again on each floor). */
  private view(): void {
    for (const u of clones(this.p)) LOOK_BY_ID.set(u.id, lookOf(u.cls!, u.weapon!));
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.rt = new GridRuntime(this.stage, GridSim.fromState(this.p.s), this.lib, this.kit, coarsePointer());
    this.rt.setZoom(this.zoom);
    this.rt.pixelated = loadDot();
    // a light touch of glow: torches and lamps bleed a little, nothing blows out
    this.rt.enableBloom({ strength: 0.32, radius: 0.35, threshold: 0.86 });
    this.props?.dispose();
    this.props = new DelveProps(() => this.p);
    this.rt.addOverlay(this.props.root);
    this.rt.focusId = this.sel;
    this.pace();
  }

  private down(): void {
    if (!descend(this.p)) return;
    this.log.add(this.p.time, `지하 ${this.p.floor}층`, 'warn');
    this.view();
    this.select(clones(this.p)[0]!.id);
    this.hud.toast(`지하 ${this.p.floor}층`);
  }

  private select(id: string): void { this.sel = id; if (this.rt) this.rt.focusId = id; }
  private ids(): string[] { return clones(this.p).filter((u) => entOf(this.p, u.id)?.alive).map((u) => u.id); }
  private name(id: string): string { return CLASSES[unitOf(this.p, id)!.cls!].name; }
  private pace(): void { this.rt?.setWalkSpeed((RATE * this.speed) / 0.85 / Math.min(this.speed, SHOW_MAX)); }

  private toggleMenu(): void {
    if (!this.menu.open) this.pausedBeforePip = this.paused;
    this.menu.toggle();
  }

  private togglePip(tab: PipTab): void {
    if (!this.pip.open && !this.picker.open && !this.menu.open) this.pausedBeforePip = this.paused;
    this.pip.toggle(tab, this.sel);
  }

  /** On the chosen clone's own turn a skill is its action now; otherwise it is queued for the clone's next moment. */
  private skill(id: string): void {
    if (this.myTurn && id === this.sel) this.live(command(this.p, { kind: 'ultimate' }));
    else queueUltimate(this.p, id);
  }

  private key(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (!this.pip.open && !this.picker.open && !this.menu.open) this.toggleMenu(); else { this.pip.close(); this.picker.close(); this.menu.close(); } return; }
    if (this.picker.open || this.menu.open) return;
    // I (bag) and E (equipment) both open the gear the clones carry; C the record
    if (k === 'c' || k === 'i' || k === 'e' || k === 'l') { this.togglePip(k === 'c' ? 'stat' : k === 'l' ? 'roster' : 'gear'); return; }
    if (this.pip.open) return;
    if (k === ' ') { e.preventDefault(); if (this.myTurn) this.live(command(this.p, { kind: 'wait' })); else this.paused = !this.paused; }
    const pick = this.ids()[Number(k) - 1];
    if ((k === '1' || k === '2' || k === '3') && pick) this.select(pick);
    if (k === 'r') this.skill(this.sel);
    if (k === '>' || k === '.') this.down();
    if (k === 'r') this.restart();
  }

  /** The stick: one step that way (on the clone's turn a step is its action; otherwise a short walk the party follows). */
  private nudge(dx: number, dy: number): void {
    const e = entOf(this.p, this.sel);
    if (!e?.alive || this.pip.open || this.picker.open) return;
    this.paused = false;
    const c = { x: e.pos.x + dx, y: e.pos.y + dy };
    if (!walkable(tileAt(this.p.s.map, c)) || this.unitAt(c)) return;
    if (this.myTurn) this.live(command(this.p, { kind: 'move', cell: c }));
    else orderTo(this.p, this.sel, c);
  }

  /** The nearest foe in sight: struck now on the clone's turn, else marked as its target. */
  private attackNearest(): void {
    const e = entOf(this.p, this.sel);
    if (!e?.alive) return;
    const foe = this.p.units.filter((u) => u.side === 'foe' && !u.asleep && entOf(this.p, u.id)?.alive && this.p.s.visible.has(idx(this.p.s.map, entOf(this.p, u.id)!.pos)))
      .sort((a, b) => Math.hypot(entOf(this.p, a.id)!.pos.x - e.pos.x, entOf(this.p, a.id)!.pos.y - e.pos.y) - Math.hypot(entOf(this.p, b.id)!.pos.x - e.pos.x, entOf(this.p, b.id)!.pos.y - e.pos.y))[0];
    if (!foe) return;
    if (this.myTurn) this.live(command(this.p, { kind: 'attack', target: foe.id }));
    else unitOf(this.p, this.sel)!.order = { kind: 'attack', target: foe.id };
  }

  /** Wait: pass the turn on the clone's turn, otherwise stop where it stands. */
  private waitOrStop(): void {
    if (this.myTurn) { this.live(command(this.p, { kind: 'wait' })); return; }
    // turn-based and nothing doing: wait passes one turn
    if (this.mode === 'turn' && !this.p.combat) { this.waitUntil = this.p.time + 1; return; }
    const u = unitOf(this.p, this.sel), e = entOf(this.p, this.sel);
    if (u && e?.alive) u.order = this.p.combat ? { kind: 'hold', cell: { ...e.pos } } : null;
  }

  /**
   * Turn-based out of a fight, time moves only while something is being done (as in Jupiter Hell): a clone walking or
   * sent somewhere, a vein being worked, a wait under way. Standing about, the turn count holds.
   */
  private still(): boolean {
    if (this.mode !== 'turn' || this.p.combat || this.movedLast || this.p.time < this.waitUntil) return false;
    return !clones(this.p).some((u) => {
      const e = entOf(this.p, u.id);
      if (!e?.alive) return false;
      if (u.order?.kind === 'move' || u.order?.kind === 'attack') return true;
      return this.p.oreNodes.some((n) => n.left > 0 && dist(n.pos, e.pos) <= 1);
    });
  }

  private unitAt(c: Cell) { return this.p.units.find((u) => entOf(this.p, u.id)?.alive && same(entOf(this.p, u.id)!.pos, c) && this.p.s.visible.has(idx(this.p.s.map, c))); }

  /** On a clone: choose it. On its turn a click is its action (a step toward, or a blow); otherwise an order. */
  private click(e: PointerEvent): void {
    const c = this.rt?.cellAt(e.clientX, e.clientY);
    if (!c) return;
    const at = this.unitAt(c);
    if (at?.side === 'hero') { this.select(at.id); return; }
    if (!entOf(this.p, this.sel)?.alive) this.select(this.p.leader ?? 'hero');
    // an order given while stopped sets the game going again (a phone has no Space key)
    this.paused = false;
    // a tap on an ore vein, a chest or a wall goes to stand beside it (that is what works a vein or opens a chest)
    const from = entOf(this.p, this.sel)?.pos, to = from && !at ? tapCell(this.p.s.map, from, c, (n) => !this.unitAt(n)) : null;
    if (this.myTurn) {
      if (at) this.live(command(this.p, { kind: 'attack', target: at.id }));
      else if (to) this.live(command(this.p, { kind: 'move', cell: to }));
      return;
    }
    const me = unitOf(this.p, this.sel);
    if (!me) return;
    if (at) me.order = { kind: 'attack', target: at.id };
    else if (to) orderTo(this.p, this.sel, to);
  }

  private marks(): void {
    if (!this.rt) return;
    const me = unitOf(this.p, this.sel), e = me && entOf(this.p, me.id), o = me?.order, m = this.p.s.map, h = this.hover;
    this.rt.showAim(null, true);
    const hoverWalk = h && e?.alive && this.p.s.seen[idx(m, h)] && walkable(tileAt(m, h)) && !same(h, e.pos) && !this.unitAt(h) ? findPath(m, e.pos, h) : null;
    this.rt.showPath(hoverWalk ?? (o?.kind === 'move' && e?.alive ? findPath(m, e.pos, o.cell) : null));
  }

  /** The stairs down and the lift up, as buttons over them while the party can take them. */
  private placePrompts(): void {
    const list: Prompt[] = [];
    if (this.p.s.map.stairs && canDescend(this.p)) list.push({ at: this.p.s.map.stairs, label: '▼ 계단', act: () => this.down() });
    if (this.opts.onAscend && canAscend(this.p)) list.push({ at: this.p.base, label: '▲ 지상으로', act: () => { if (canAscend(this.p)) this.opts.onAscend!(takeParty(this.p)); } });
    this.prompts.update(this.rt, list);
  }

  private labels(): void {
    if (!this.rt) return;
    // no names over heads: only a marker over the clone whose turn it is
    this.el.querySelector('.pd-labels')!.innerHTML = clones(this.p).filter((u) => entOf(this.p, u.id)?.alive && this.p.waiting && this.p.manual === u.id).map((u) => {
      const e = entOf(this.p, u.id)!, pt = this.rt!.project(new THREE.Vector3(e.pos.x, 2.3, e.pos.y));
      return `<div class="pd-label on" style="left:${pt.left}px;top:${pt.top}px">▼</div>`;
    }).join('');
  }

  private drawHud(): void {
    const p = this.p;
    // no mode banner: the top centre says floor and turn, the frames say whose turn it is
    const mode = '';
    const status = `<span>지하 <b>${p.floor}층</b></span><span>턴 <b>${Math.floor(p.time)}</b></span>`;
    const target = targetCardHtml(p, this.sel, cardTarget(p, this.sel, this.hover ? this.unitAt(this.hover)?.id : undefined));
    this.hud.draw(p, this.ids(), this.sel, { log: this.log, status, mode, stairs: canDescend(p), lift: canAscend(p), myTurn: this.myTurn, target });
  }
}
