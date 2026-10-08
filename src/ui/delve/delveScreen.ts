import { loadDot, saveDot } from '../../app/gridPreferences';
import * as THREE from 'three';
import type { Screen } from '../../app/router';
import { GridSim } from '../../sim/grid/gridSim';
import { findPath } from '../../sim/grid/path';
import { dist, idx, same, walkable, tileAt, type Cell, type GEvent } from '../../sim/grid/types';
import { alive, entOf, unitOf, type Unit } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { targetCardHtml } from '../overworld/targetCard';
import { tapCell } from './tapCell';
import { MiningCue } from './miningCue';
import { AutoExplore, exploreWants } from './explore';
import { QuickSlots } from '../overworld/quickSlots';
import { PlacePrompts, type Prompt } from '../overworld/placePrompt';
import { command } from '../../sim/party/partySim';
import { queueUltimate, ultSlots } from '../../sim/party/ultimate';
import { canBeacon, canEnterPortal, enterPortal, portalOpen, startBeacon } from '../../sim/delve/beacon';
import { aimNeeded } from './aim';
import { ULT_KEYS } from '../overworld/partyFrames';
import { clones, orderTo } from '../../sim/roam/roam';
import { canAscend, canDescend, delveTick, descend, newDelve, type DelveParty } from '../../sim/delve/delveSim';
import { takeParty, type Carry } from '../../sim/roam/carry';
import { GridRuntime } from '../../view/grid/gridRuntime';
import { LOOK_BY_ID } from '../../view/grid/gridActors';
import { summonLook } from '../../view/grid/species';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import { lookOf } from '../party/partyPick';
import { PipWindow, type PipTab } from '../overworld/pipWindow';
import { TraitPicker } from '../overworld/traitPicker';
import { OptionsMenu } from '../overworld/optionsMenu';
import { pickTrait, rerollOffer } from '../../sim/party/partyLevel';
import type { TraitId } from '../../sim/party/traitDefs';
import { WorldHud, statusLine } from '../overworld/worldHud';
import { WorldLog } from '../overworld/worldLog';
import { Pinch, coarsePointer, phoneUpright, startZoom } from '../overworld/touchView';
import { CardStrip } from '../overworld/cardStrip';
import { DelveMinimap } from './delveMinimap';
import { DelveProps } from '../../view/delve/delveProps';
import { HOLD_MS, TouchPad } from '../overworld/touchPad';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/partyScreen.css';
import '../styles/worldHud.css';
import '../styles/worldPanels.css';
import '../styles/hudFrames.css';

/** game time per real second at normal speed */
const RATE = 3.6;
const SHOW_MAX = 2;
const SPEEDS = [1, 2, 4];

/**
 * The dungeon below the ship. Exploring runs in real time; when a band notices the party the fight turns
 * turn-based as in Jupiter Hell — time stops on the chosen clone's moment, the companions act by themselves (1 2 3 switches
 * which clone is under the hand). The fight can be set to real time with pause instead.
 */
export class DelveScreen implements Screen {
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
  /** turn by turn (opts.stepped): the moment the current turn ends */
  private turnEnd = 1;
  private speed = 1;
  private zoom = 11;
  private hover: Cell | null = null;
  /** the foe being looked at (a long press on it): its card shows until the next tap or a few seconds pass */
  private inspect: { id: string; until: number } | null = null;
  /** a long press is under way on the field, or has just fired (the tap that ends it is swallowed) */
  private press: { x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
  private held = false;
  private readonly miningCue = new MiningCue();
  private readonly quick = new QuickSlots(() => this.p, () => this.sel, (ev) => this.live(ev), ['potion']);
  /** the build along the bottom (an upright phone): the ultimate and the cards, each lit as it fires; a tapped card tells what it is for a while */
  private readonly cards = new CardStrip(() => this.p, () => this.sel, { ult: (slot) => this.skill(this.sel, slot), info: (html) => { this.cardInfo = { html, until: performance.now() + 6000 }; } });
  private cardInfo: { html: string; until: number } | null = null;
  private readonly explorer = new AutoExplore();
  private readonly prompts = new PlacePrompts();
  /** whether the last tick moved anyone (followers still catching up keep time going) */
  private movedLast = true;
  /** turn-based: a wait runs time on to here */
  private waitUntil = 0;
  private warned = new Set<string>();
  private raf = 0;
  private readonly seed: number;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);
  private pinch!: Pinch;

  /** opts.party: the floor the expedition's party came down to; onAscend: the party rides up to the pod (also when nobody is left); restart: the expedition starts over; auto: every clone fights by itself (the chain demo); stepped: the game stops at each turn's end until the next is asked for. */
  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit, private readonly opts: { seed?: number; quit?: () => void; party?: DelveParty; onAscend?: (c: Carry) => void; onBeacon?: (c: Carry) => void; restart?: () => void; auto?: boolean; stepped?: boolean } = {}) {
    this.seed = opts.seed ?? (Number(new URLSearchParams(location.search).get('seed')) || 1);
  }

  mount(root: HTMLElement): void {
    this.el.className = 'screen grid landscape party world delve';
    this.el.innerHTML = '<div class="grid-stage"></div><div class="pd-labels"></div><div class="pd-pause">일시정지</div>';
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    this.hud = new WorldHud(this.el, {
      menu: () => this.toggleMenu(),
      stat: () => this.togglePip('stat'), bag: () => this.togglePip('bag'),
      select: (id) => this.select(id),
      skill: (id, slot) => this.skill(id || this.sel, slot),
      beacon: () => this.beacon(), solo: true,
      traits: (id) => { if (!this.pip.open && !this.picker.open && !this.menu.open && !this.picker.open) this.pausedBeforePip = this.paused; this.picker.show(id || this.sel); },
      wait: () => { if (this.myTurn) this.live(command(this.p, { kind: 'wait' })); },
    });
    this.pip = new PipWindow(() => this.p, () => { this.paused = this.pausedBeforePip; }, (ev) => this.live(ev), true);
    this.el.appendChild(this.prompts.el);
    this.el.appendChild(this.quick.el);
    this.el.appendChild(this.cards.el);
    this.el.appendChild(this.pip.el);
    this.picker = new TraitPicker(() => this.p, (id, t) => this.live(pickTrait(this.p, id, t as TraitId)), () => { this.paused = this.pausedBeforePip; }, (id) => this.live(rerollOffer(this.p, id)));
    this.el.appendChild(this.picker.el);
    this.menu = new OptionsMenu(() => ({ speed: this.speed, speeds: SPEEDS, dot: this.rt?.pixelated ?? loadDot(), keys: '클릭 이동·공격 · R T 궁극기 · B 신호기 · Space 대기 · 1 2 3 조종 · C 상태 · I 가방 · 휠 확대' }), {
      speed: (v) => { this.speed = v; this.pace(); },
      dot: () => { if (!this.rt) return; this.rt.pixelated = !this.rt.pixelated; saveDot(this.rt.pixelated); },
      pip: (tab) => this.togglePip(tab),
      restart: () => (this.opts.restart ? this.opts.restart() : this.restart()), quit: this.opts.quit,
      close: () => { this.paused = this.pausedBeforePip; },
    });
    this.el.appendChild(this.menu.el);
    this.pad = new TouchPad({ dir: (dx, dy) => this.nudge(dx, dy), attack: () => this.attackNearest(), wait: () => this.waitOrStop(), bag: () => this.togglePip('bag'), explore: () => this.explorer.start(), tap: (x, y) => this.click({ clientX: x, clientY: y } as PointerEvent), hold: (x, y) => this.look(x, y) });
    this.el.appendChild(this.pad.el);
    if (this.opts.stepped) {
      const next = document.createElement('button');
      next.type = 'button'; next.className = 'step-next'; next.textContent = '다음 턴 ▶';
      next.addEventListener('click', () => { this.paused = false; });
      this.el.appendChild(next);
    }
    this.mini = new DelveMinimap(() => this.p);
    this.hud.minimapSlot.replaceChildren(this.mini.el);
    this.pinch = new Pinch(this.stage, () => this.zoom, (z) => { this.zoom = Math.min(26, Math.max(7, z)); this.rt?.setZoom(this.zoom); }, [this.pad.zone], () => this.pad.cancel());
    this.zoom = startZoom(this.zoom);
    // a finger held still on a foe looks at it (its card); the tap that ends the press does nothing more
    const drop = () => { if (this.press) { clearTimeout(this.press.timer); this.press = null; } };
    this.stage.addEventListener('pointerdown', (e) => {
      drop();
      if (e.pointerType !== 'touch') return;
      const x = e.clientX, y = e.clientY;
      this.press = { x, y, timer: setTimeout(() => { this.press = null; if (this.look(x, y)) this.held = true; }, HOLD_MS) };
    });
    this.stage.addEventListener('pointermove', (e) => { if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 14) drop(); });
    this.stage.addEventListener('pointercancel', drop);
    // a pointer-up that ends a pinch or a drag is not a click
    this.stage.addEventListener('pointerup', (e) => { drop(); if (this.held) { this.held = false; return; } if (e.pointerType !== 'touch' || this.pinch.tapped) this.click(e); });
    this.stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.hover = this.rt?.cellAt(e.clientX, e.clientY) ?? null; });
    this.stage.addEventListener('pointerleave', () => { this.hover = null; });
    this.stage.addEventListener('contextmenu', (e) => { e.preventDefault(); this.aiming = null; });
    this.stage.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.min(20, Math.max(7, this.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); this.rt?.setZoom(this.zoom); }, { passive: false });
    addEventListener('keydown', this.onKey);
    // tests and screenshots reach in through this handle
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __delve: DelveScreen }).__delve = this;
    this.restart();
    let last = performance.now();
    const loop = (now: number) => {
      // a frame's timestamp can come just before the moment the loop began: never a step back in time
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      this.handOver();
      if (!this.paused && !this.pip.open && !this.picker.open && !this.menu.open && !this.p.waiting && !this.still()) {
        const t0 = this.p.time;
        const ev = delveTick(this.p, dt * RATE * this.speed);
        this.movedLast = ev.some((e) => e.type === 'move');
        this.live(ev, t0);
        // turn by turn: stop at each turn's end (the show plays on) until Space, a tap or the button asks for the next
        if (this.opts.stepped && this.p.time >= this.turnEnd) { this.paused = true; this.turnEnd = Math.floor(this.p.time) + 1; }
      }
      this.pad.update(dt, !!this.p.combat);
      this.props?.update(dt);
      // the states the units stand in, for their steady looks (a burning foe burns on screen for as long as it burns)
      if (this.rt) { const t = this.p.time, on = (u: Unit, id: 'burn' | 'freeze' | 'poison') => (u.status[id]?.until ?? 0) > t; this.rt.partyStates(this.p.units.filter((u) => alive(this.p, u) && (on(u, 'burn') || on(u, 'freeze') || on(u, 'poison'))).map((u) => ({ id: u.id, burn: on(u, 'burn'), freeze: on(u, 'freeze'), poison: on(u, 'poison') }))); }
      this.rt?.update(dt * Math.min(this.speed, SHOW_MAX));
      this.miningCue.update(this.p, this.rt);
      this.quick.update();
      this.cards.update();
      { const e = entOf(this.p, this.sel); this.explorer.step(this.p.s, e?.alive ? e.pos : undefined, unitOf(this.p, this.sel)?.order?.kind === 'move', !!this.p.combat, (c) => orderTo(this.p, this.sel, c), (t) => this.hud.toast(t), exploreWants(this.p)); }
      this.placePrompts();
      this.marks();
      this.labels();
      this.el.classList.toggle('paused', this.paused && !this.opts.stepped && !this.pip.open && !this.picker.open && !this.menu.open);
      this.drawHud();
      this.mini.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  unmount(): void { removeEventListener('keydown', this.onKey); cancelAnimationFrame(this.raf); this.rt?.dispose(); this.el.remove(); }

  /** In a turn-based fight the chosen clone is under the hand; out of a fight (or in real time) nobody is. */
  private handOver(): void {
    // the game is turn-based: in a fight the chosen clone's moments wait for the player
    const hand = this.p.combat && !this.opts.auto && entOf(this.p, this.sel)?.alive ? this.sel : undefined;
    if (this.p.manual !== hand) { this.p.manual = hand; this.p.waiting = false; }
  }

  /** the soul slot whose aimed ultimate waits for a cell */
  private aiming: number | null = null;
  private get myTurn(): boolean { return !!this.p.waiting && this.p.manual === this.sel; }

  private live(ev: GEvent[], t0 = this.p.time): void {
    if (!ev.length) return;
    for (const e of ev) {
      // a summon wears its own look from the moment it rises (never the floor's foe look)
      if (e.type === 'summon' && e.dst) { this.dress(e.dst); continue; }
      if (e.type !== 'buff' || (e.text !== 'soul' && e.text !== 'print')) continue;
      const u = unitOf(this.p, e.dst!)!;
      LOOK_BY_ID.set(u.id, lookOf(u.cls!, u.weapon!));
      if (e.text === 'soul') this.rt?.actors.absorb(u.id);
    }
    this.rt?.applyLive(ev, t0);
    // the log is told as the show plays each event (a chain's lines run by with its effects); with no stage, all at once
    if (!this.rt) this.log.read(this.p, ev);
    for (const e of ev) {
      if (e.type === 'die' && unitOf(this.p, e.dst!)?.side === 'hero') this.alert(`dead${e.dst}`, `${this.name(e.dst!)} 쓰러짐`, false);
      if (e.type === 'wake') this.alert(`wake${this.p.floor}:${e.text}`, '적 발견', false);
      if (e.type === 'telegraph' && e.to) { this.props?.slam(e.to, e.amount ?? 2); this.hud.toast('내려찍기!'); }
      if (e.type === 'victory') this.hud.toast('마왕군 장군 처치');
      if (e.type === 'levelUp') this.hud.toast(`${this.name(e.src!)} 레벨 ${e.amount}`);
      if (e.type === 'buff' && e.text === 'soul') this.hud.toast(`${this.name(e.dst!)} 영혼 깃듦`);
      if (e.type === 'buff' && e.text === 'print') { this.hud.toast(unitOf(this.p, e.dst!)!.cls === 'shell' ? '새 몸이 깨어남' : '클론 출력'); if (!entOf(this.p, this.sel)?.alive) this.select(e.dst!); }
      if (e.type === 'drop') this.hud.toast('영혼 소멸');
      if (e.type === 'buff' && e.text === 'beaconEnter' && this.opts.onBeacon) setTimeout(() => this.opts.onBeacon!(takeParty(this.p)), 900);
      if (e.type === 'buff' && e.text === 'beaconCut') this.hud.toast('신호기 끊김');
      if (e.type === 'buff' && e.text === 'beaconOpen') this.hud.toast('포탈 열림');
      if (e.type === 'buff' && e.text === 'beaconClosed') this.hud.toast('포탈 닫힘');
      if (e.type === 'dead') {
        this.hud.toast('사망');
        this.log.add(e.t, e.text === 'lost' ? '쓰러졌다. 영혼이 소멸했다.' : '쓰러졌다. 새 몸을 만들 재료가 모자란다.', 'warn');
        // below ground nobody comes back on their own: the pod takes it from here
        if (e.text === 'lost' && this.opts.onAscend) setTimeout(() => this.opts.onAscend!(takeParty(this.p)), 2200);
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
    this.log.add(this.p.time, `승강기를 타고 지하 ${this.p.floor}층으로 내려갔다.`, 'warn');
    LOOK_BY_ID.clear();
    this.view();
    this.select(this.p.leader ?? 'hero');
    this.paused = false;
  }

  /** A summon's look: bone and spectral green for a skeleton or a golem, its master in shadow for a clone. */
  private dress(id: string): void {
    const u = unitOf(this.p, id), master = u?.summoner ? unitOf(this.p, u.summoner) : undefined;
    if (!u?.summoner) return;
    LOOK_BY_ID.set(id, summonLook(u.golem ? 'golem' : u.mirror ? 'mirror' : u.weapon === 'longbow' ? 'archer' : 'skeleton', master?.cls && master.weapon ? lookOf(master.cls, master.weapon) : undefined));
  }

  /** The floor's view (built again on each floor). */
  private view(): void {
    for (const u of clones(this.p)) LOOK_BY_ID.set(u.id, lookOf(u.cls!, u.weapon!));
    for (const u of this.p.units) if (u.summoner) this.dress(u.id);
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.rt = new GridRuntime(this.stage, GridSim.fromState(this.p.s), this.lib, this.kit, coarsePointer(), (e) => { this.log.tell(this.p, e); this.cards.flash(e); }); this.rt.partyShow();
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
    this.log.add(this.p.time, `지하 ${this.p.floor}층에 내려섰다.`, 'warn');
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

  /** A soul's ultimate: an aimed one waits for a cell to be picked; otherwise it is the clone's action on its turn, or queued for its next moment. */
  private skill(id: string, slot = 0): void {
    const u = unitOf(this.p, id);
    if (!u) return;
    if (aimNeeded(u, slot)) { this.select(id); this.aiming = slot; this.hud.toast('위치 선택'); return; }
    if (this.myTurn && id === this.sel) this.live(command(this.p, { kind: 'ultimate', slot }));
    else queueUltimate(this.p, id, undefined, slot);
  }

  /** The return beacon: the portal starts opening where the clone stands. */
  private beacon(): void { if (canBeacon(this.p)) this.live(startBeacon(this.p)); }

  private key(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === 'escape' && this.aiming !== null) { this.aiming = null; return; }
    if (k === 'escape') { if (!this.pip.open && !this.picker.open && !this.menu.open) this.toggleMenu(); else { this.pip.close(); this.picker.close(); this.menu.close(); } return; }
    if (this.picker.open || this.menu.open) return;
    // C the record, K the skills, E what is worn, I the bag (down here there is no roster and no soul-stone tab: stones lie in the bag)
    if (k === 'c' || k === 'i' || k === 'e' || k === 'k') { this.togglePip(k === 'c' ? 'stat' : k === 'k' ? 'skill' : k === 'i' ? 'bag' : 'gear'); return; }
    if (this.pip.open) return;
    if (k === ' ') { e.preventDefault(); if (this.myTurn) this.live(command(this.p, { kind: 'wait' })); else this.paused = !this.paused; }
    const pick = this.ids()[Number(k) - 1];
    if ((k === '1' || k === '2' || k === '3') && pick) this.select(pick);
    const ult = ULT_KEYS.indexOf(k), sel = unitOf(this.p, this.sel), slot = ult >= 0 && sel ? ultSlots(sel)[ult]?.slot : undefined;
    if (slot !== undefined) this.skill(this.sel, slot);
    if (k === 'b') this.beacon();
    if (k === '>' || k === '.') this.down();
  }

  /** The stick: one step that way (on the clone's turn a step is its action; otherwise a short walk the party follows). */
  private nudge(dx: number, dy: number): void {
    const e = entOf(this.p, this.sel);
    if (!e?.alive || this.pip.open || this.picker.open) return;
    this.paused = false;
    this.explorer.stop();
    const c = { x: e.pos.x + dx, y: e.pos.y + dy };
    if (!walkable(tileAt(this.p.s.map, c)) || this.unitAt(c)) return;
    if (this.myTurn) this.live(command(this.p, { kind: 'move', cell: c }));
    else orderTo(this.p, this.sel, c);
  }

  /** Looks at the foe under a point of the screen: its card shows for a while. False when no foe is there. */
  private look(x: number, y: number): boolean {
    // the finger is on the figure as drawn (it stands taller than its cell), else on its cell
    const foes = this.p.units.filter((u) => u.side === 'foe' && entOf(this.p, u.id)?.alive).map((u) => u.id);
    const c = this.rt?.cellAt(x, y), on = c ? this.unitAt(c) : undefined;
    const id = this.rt?.figureAt(x, y, foes) ?? (on?.side === 'foe' ? on.id : undefined);
    if (!id) return false;
    this.inspect = { id, until: performance.now() + 6000 };
    return true;
  }

  /** Whom the attack key strikes: the foe the clone was told to go for, else the nearest foe awake and in sight. */
  private attackTarget(): Unit | undefined {
    const e = entOf(this.p, this.sel), me = unitOf(this.p, this.sel);
    if (!e?.alive || !me) return undefined;
    const told = me.order?.kind === 'attack' ? unitOf(this.p, me.order.target) : undefined;
    if (told && entOf(this.p, told.id)?.alive) return told;
    return this.p.units.filter((u) => u.side === 'foe' && !u.asleep && entOf(this.p, u.id)?.alive && this.p.s.visible.has(idx(this.p.s.map, entOf(this.p, u.id)!.pos)))
      .sort((a, b) => Math.hypot(entOf(this.p, a.id)!.pos.x - e.pos.x, entOf(this.p, a.id)!.pos.y - e.pos.y) - Math.hypot(entOf(this.p, b.id)!.pos.x - e.pos.x, entOf(this.p, b.id)!.pos.y - e.pos.y))[0];
  }

  /** The foe the attack key would strike (it wears the mark on the field): struck now on the clone's turn, else set as its target. */
  private attackNearest(): void {
    const foe = this.attackTarget();
    if (!foe) return;
    if (this.myTurn) this.live(command(this.p, { kind: 'attack', target: foe.id }));
    else unitOf(this.p, this.sel)!.order = { kind: 'attack', target: foe.id };
  }

  /** Wait: pass the turn on the clone's turn, otherwise stop where it stands. */
  private waitOrStop(): void {
    if (this.opts.stepped) { this.paused = false; return; }
    if (this.myTurn) { this.live(command(this.p, { kind: 'wait' })); return; }
    // turn-based and nothing doing: wait passes one turn
    if (!this.p.combat) { this.waitUntil = this.p.time + 1; return; }
    const u = unitOf(this.p, this.sel), e = entOf(this.p, this.sel);
    if (u && e?.alive) u.order = this.p.combat ? { kind: 'hold', cell: { ...e.pos } } : null;
  }

  /**
   * Turn-based out of a fight, time moves only while something is being done (as in Jupiter Hell): a clone walking or
   * sent somewhere, a vein being worked, a wait under way. Standing about, the turn count holds.
   */
  private still(): boolean {
    if (this.p.combat || this.movedLast || this.p.time < this.waitUntil) return false;
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
    this.inspect = null; this.cardInfo = null;
    if (this.opts.stepped) { this.paused = false; return; }
    const c = this.rt?.cellAt(e.clientX, e.clientY);
    if (!c) return;
    if (this.aiming !== null) {
      const slot = this.aiming; this.aiming = null; this.paused = false;
      if (this.myTurn) this.live(command(this.p, { kind: 'ultimate', cell: c, slot })); else queueUltimate(this.p, this.sel, c, slot);
      return;
    }
    const at = this.unitAt(c);
    if (at?.side === 'hero') { this.select(at.id); return; }
    if (!entOf(this.p, this.sel)?.alive) this.select(this.p.leader ?? 'hero');
    // an order given while stopped sets the game going again (a phone has no Space key); it also ends auto-explore
    this.explorer.stop();
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
    // the foe the attack key would strike wears a mark (on a touch screen, where the key is; with a mouse only a foe it was told to go for)
    this.rt.markTarget((coarsePointer() && !phoneUpright()) || o?.kind === 'attack' ? this.attackTarget()?.id : undefined);
    const hoverWalk = h && e?.alive && this.p.s.seen[idx(m, h)] && walkable(tileAt(m, h)) && !same(h, e.pos) && !this.unitAt(h) ? findPath(m, e.pos, h) : null;
    this.rt.showPath(hoverWalk ?? (o?.kind === 'move' && e?.alive ? findPath(m, e.pos, o.cell) : null));
  }

  /** The stairs down and the lift up, as buttons over them while the party can take them. */
  private placePrompts(): void {
    const list: Prompt[] = [];
    if (this.p.s.map.stairs && canDescend(this.p)) list.push({ at: this.p.s.map.stairs, label: '▼ 계단', act: () => this.down() });
    const b = this.p.beacon;
    if (b && canEnterPortal(this.p)) list.push({ at: b.at, label: `◎ 들어가기 ${Math.max(0, Math.ceil(b.closeAt - this.p.time))}`, act: () => this.live(enterPortal(this.p)) });
    else if (b && portalOpen(this.p)) list.push({ at: b.at, label: `◎ 포탈 ${Math.max(0, Math.ceil(b.closeAt - this.p.time))}`, act: () => { this.paused = false; if (this.myTurn) { const to = b.at; this.live(command(this.p, { kind: 'move', cell: to })); } else orderTo(this.p, this.sel, b.at); } });
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
    const status = statusLine(`지하 <b>${p.floor}층</b>`, p, false);
    // a foe's card shows only when it is looked at: a long press on a touch screen, the mouse over it otherwise
    if (this.inspect && (performance.now() > this.inspect.until || !entOf(p, this.inspect.id)?.alive)) this.inspect = null;
    const looked = this.inspect ? unitOf(p, this.inspect.id) : this.hover ? this.unitAt(this.hover) : undefined;
    if (this.cardInfo && performance.now() > this.cardInfo.until) this.cardInfo = null;
    const target = this.cardInfo?.html ?? targetCardHtml(p, this.sel, looked?.side === 'foe' ? looked : undefined);
    const beacon = p.beacon ? { label: portalOpen(p) ? `포탈 ${Math.max(0, Math.ceil(p.beacon.closeAt - p.time))}` : `신호기 ${Math.max(0, Math.ceil(p.beacon.openAt - p.time))}`, on: false } : { label: '신호기', on: canBeacon(p) };
    this.hud.draw(p, this.ids(), this.sel, { log: this.log, status, mode, stairs: canDescend(p), lift: canAscend(p), myTurn: this.myTurn, target, beacon, place: `지하 ${p.floor}층` });
  }
}
