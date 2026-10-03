import type { Screen } from '../../app/router';
import { HoldRepeat, interruption, quantize8 } from '../../app/input/gridInput';
import { shootable, walkBlocked } from '../../sim/grid/actions';
import { activeWeapon } from '../../sim/grid/gear';
import { WEAPONS, type BeltItem } from '../../sim/grid/items';
import { canFire } from '../../sim/grid/weapons';
import { GridBag } from './gridBag';
import { LevelUpPanel } from './levelUp';
import { GridAim } from './gridAim';
import { GridBelt, ITEM_NAME, THROWN } from './gridBelt';
import { weaponState } from './weaponInfo';
import type { GridSim } from '../../sim/grid/gridSim';
import { findPath } from '../../sim/grid/path';
import { dist, idx, same, tileAt, walkable, type Cell, type GAction } from '../../sim/grid/types';
import type { UalLibrary } from '../../view/grid/ualActor';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import { GridRuntime } from '../../view/grid/gridRuntime';
import { watchLayout } from '../extract/orientation';
import { isTouchDevice } from '../extract/touchControls';
import { ZoomControl } from '../extract/zoomControl';
import { guardFrame } from '../screens/loopGuard';
import { GridControls, type GridCmd } from './gridControls';
import { GridHud } from './gridHud';
import { GridTouch } from './gridTouch';
import '../styles/grid.css';

export interface GridApi { sim: GridSim; lib: UalLibrary; kit: DungeonKit; end(): void; fatal(e: unknown): void }

const WALK_EVERY = 0.14;
const PIXEL_KEY = 'projr.grid.pixel';
const loadPixel = (): boolean => { try { return localStorage.getItem(PIXEL_KEY) !== '0'; } catch { return true; } };
const savePixel = (on: boolean): void => { try { localStorage.setItem(PIXEL_KEY, on ? '1' : '0'); } catch { /* not kept */ } };
const TAP_PX = 12;
const TAP_MS = 350;

/** The grid sortie: input → one sim action → the runtime replays it; the world only moves when the hero does. */
export class GridScreen implements Screen {
  private readonly el = document.createElement('div');
  private rt: GridRuntime | null = null;
  private readonly hud = new GridHud();
  private readonly controls = new GridControls();
  private readonly hold = new HoldRepeat(WALK_EVERY);
  private touch: GridTouch | null = null;
  private zoom: ZoomControl | null = null;
  private bag: GridBag | null = null;
  private levelUp: { panel: LevelUpPanel; offer: unknown } | null = null;
  private readonly belt = new GridBelt((it) => this.controls.push(it));
  private aim: GridAim | null = null;
  private aimKey = '';
  private readonly aimBar = document.createElement('div');
  private cleanup: (() => void)[] = [];
  private walk: Cell[] | null = null;
  private walkTimer = 0;
  /** a held direction stops when something new shows up, until it is let go */
  private holdLock = false;
  private stickDir: Cell | null = null;
  private tap: { id: number; x: number; y: number; at: number } | null = null;
  private raf = 0;
  private gone = false;
  private ended = false;
  private endTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly api: GridApi) {}

  private get s() {
    return this.api.sim.s;
  }

  mount(root: HTMLElement): void {
    this.el.className = 'screen grid';
    this.el.dataset.testid = 'grid-sortie';
    this.el.innerHTML = '<div class="grid-stage"></div>';
    root.appendChild(this.el);
    const stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    const mobile = isTouchDevice();
    try {
      this.rt = new GridRuntime(stage, this.api.sim, this.api.lib, this.api.kit, mobile, (e) => this.hud.cue(e));
    } catch (e) {
      return this.api.fatal(e);
    }
    this.el.appendChild(this.hud.el);
    this.aimBar.className = 'gaim';
    this.aimBar.hidden = true;
    this.aimBar.innerHTML = '<span></span><button class="btn primary" data-a="go" data-testid="grid-aim-go">던지기</button><button class="btn" data-a="no">취소</button>';
    this.aimBar.addEventListener('click', (e) => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a; if (a) this.controls.push(a === 'go' ? 'confirm' : 'cancel'); });
    this.el.append(this.belt.el, this.aimBar);
    if (mobile) {
      this.touch = new GridTouch((c) => this.controls.push(c));
      this.el.appendChild(this.touch.el);
    }
    const rt = this.rt;
    this.zoom = new ZoomControl({ setHeight: (h) => rt.setZoom(h) }, stage, () => this.touch?.releaseStick(),
      { key: 'projr.grid.zoom', defaults: { portrait: 18, landscape: 11 }, pad: '.gt-pad', stage: '.grid-stage' });
    this.el.appendChild(this.zoom.el);
    const px = document.createElement('button');
    px.className = 'btn grid-pixel';
    px.dataset.testid = 'grid-pixel';
    const showPx = () => { px.textContent = rt.pixelated ? '도트' : 'HD'; };
    rt.pixelated = loadPixel();
    showPx();
    px.addEventListener('click', () => { rt.pixelated = !rt.pixelated; savePixel(rt.pixelated); showPx(); });
    this.zoom.el.appendChild(px);
    this.cleanup.push(this.controls.attach(), watchLayout((l) => {
      this.el.classList.toggle('portrait', l === 'portrait');
      this.el.classList.toggle('landscape', l === 'landscape');
      this.zoom?.setLayout(l);
    }));
    stage.addEventListener('pointerdown', (e) => { this.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() }; });
    stage.addEventListener('pointerup', (e) => {
      const t = this.tap;
      this.tap = null;
      if (t && t.id === e.pointerId && Math.hypot(e.clientX - t.x, e.clientY - t.y) < TAP_PX && performance.now() - t.at < TAP_MS) this.onTap(e.clientX, e.clientY);
    });
    (window as unknown as { __PROJR_GRID__: unknown }).__PROJR_GRID__ = { state: () => this.s, act: (a: GAction) => this.doAction(a), walkTo: (c: Cell) => this.walkTo(c), walking: () => !!this.walk, toStairs: () => { if (this.s.map.stairs) this.walkTo(this.s.map.stairs); } };
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (guardFrame(() => this.frame(dt), (err) => this.api.fatal(err)) && !this.gone) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private visibleFoes(): Set<string> {
    const s = this.s;
    return new Set(s.foes.filter((f) => f.alive && s.visible.has(idx(s.map, f.pos))).map((f) => f.id));
  }

  /** Runs one action; false if it could not be done. Something new in sight or a hit stops held/auto walking. */
  private doAction(a: GAction): boolean {
    const s = this.s;
    const before = this.visibleFoes();
    const hp = s.hero.hp;
    const t0 = s.time;
    const ev = this.api.sim.act(a);
    if (!ev.length || (ev.length === 1 && ev[0]!.type === 'blocked')) return false;
    this.rt?.apply(ev, t0);
    const stop = interruption([...this.visibleFoes()].some((id) => !before.has(id)), s.hero.hp < hp);
    if (stop.walk) this.walk = null;
    if (stop.hold) { this.hold.reset(); this.holdLock = true; }
    return true;
  }

  private command(c: GridCmd): void {
    const s = this.s;
    const item = (THROWN as string[]).includes(c) ? (c as Exclude<BeltItem, 'potion'>) : null;
    if (this.aim) {
      if (c === 'confirm' || c === 'shoot' || item === this.aim.item) this.throwAim();
      else if (c === 'cancel' || item) { this.aim = null; if (item && s.hero.gear.belt[item] > 0) this.aim = new GridAim(s, item); }
      return;
    }
    if (item) { if (s.hero.gear.belt[item] > 0) this.aim = new GridAim(s, item); return; }
    if (c === 'next' || c === 'prev') {
      const list = shootable(s).sort((a, b) => dist(s.hero.pos, s.foes.find((f) => f.id === a)!.pos) - dist(s.hero.pos, s.foes.find((f) => f.id === b)!.pos));
      if (!list.length) return;
      const at = list.indexOf(this.api.sim.autoTarget() ?? '');
      s.hero.target = list[(at + (c === 'next' ? 1 : list.length - 1)) % list.length];
      return;
    }
    if (c === 'bag') return this.toggleBag();
    if (c === 'potion') { this.doAction({ kind: 'use', item: 'potion' }); return; }
    if (c === 'swap') { this.doAction({ kind: 'swap' }); return; }
    if (c === 'shoot') {
      const w = activeWeapon(s.hero.gear);
      const other = s.hero.gear.hands[s.hero.gear.active === 0 ? 1 : 0];
      // fire with a melee weapon in hand: switch to the ranged one in the other hand
      if (!w || WEAPONS[w.group].melee) { if (other && !WEAPONS[other.group].melee) this.doAction({ kind: 'swap' }); return; }
      const target = this.api.sim.autoTarget();
      if (target) this.doAction({ kind: 'shoot', target });
      return;
    }
    if (c === 'wait') this.doAction({ kind: 'wait' });
  }

  private throwAim(): void {
    const a = this.aim;
    if (a && a.ok && this.doAction({ kind: 'use', item: a.item, at: a.cell })) this.aim = null;
  }

  /** Throw preview and the aim bar follow the reticle. */
  private drawAim(): void {
    const a = this.aim;
    const key = a ? JSON.stringify([a.item, a.cell, a.ok]) : '';
    if (key === this.aimKey) return;
    this.aimKey = key;
    this.rt?.showAim(a ? a.area() : null, !!a?.ok);
    this.aimBar.hidden = !a;
    if (a) this.aimBar.querySelector('span')!.textContent = `${ITEM_NAME[a.item]} — ${a.ok ? '칸을 다시 탭하거나 던지기' : '닿지 않는 곳'}`;
  }

  private toggleBag(): void {
    if (this.bag) { this.bag.el.remove(); this.bag = null; return; }
    this.bag = new GridBag(() => this.s.hero.gear, (a) => { this.doAction(a); }, () => this.toggleBag());
    this.el.appendChild(this.bag.el);
  }

  /** A pending level-up choice holds the game until it is made (or passed up); true while it is open. */
  private showLevelUp(): boolean {
    const offer = this.s.offers[0];
    if (this.levelUp && this.levelUp.offer === offer) return true;
    this.levelUp?.panel.el.remove();
    this.levelUp = null;
    if (!offer) return false;
    this.walk = null;
    const panel = new LevelUpPanel(offer, activeWeapon(this.s.hero.gear), this.s.hero.level, (a) => { this.doAction(a); });
    this.levelUp = { panel, offer };
    this.el.appendChild(panel.el);
    return true;
  }

  private onTap(x: number, y: number): void {
    const s = this.s;
    const c = this.rt?.cellAt(x, y);
    if (!c) return;
    if (this.levelUp) return;
    if (this.aim) { if (this.aim.tap(c)) this.throwAim(); return; }
    const foe = s.foes.find((f) => f.alive && same(f.pos, c) && s.visible.has(idx(s.map, c)));
    if (foe) { s.hero.target = foe.id; return; }
    // a barrel in sight with a ranged weapon in hand: shoot it
    const w = activeWeapon(s.hero.gear);
    if (w && !WEAPONS[w.group].melee && s.barrels.some((b) => same(b, c)) && s.visible.has(idx(s.map, c))) { this.doAction({ kind: 'shoot', at: c }); return; }
    if (s.seen[idx(s.map, c)]) this.walkTo(c);
  }

  /** Walks along a path to a cell (tap on the floor); stops when something shows up. */
  private walkTo(c: Cell): void {
    const s = this.s;
    if (!walkable(tileAt(s.map, c))) return;
    this.walk = findPath(s.map, s.hero.pos, c, (p) => walkBlocked(s, p));
    this.walkTimer = 0;
  }

  private input(dt: number): void {
    const cmd = this.controls.take();
    if (this.showLevelUp()) return;
    if (this.bag && cmd !== 'bag') { this.bag.render(); return; }
    if (cmd) { this.walk = null; this.command(cmd); return; }
    const v = this.touch?.vector();
    this.stickDir = v ? quantize8(v.x, v.y, 0.35, this.stickDir) : null;
    const dir = this.controls.dir() ?? this.stickDir;
    if (!dir) this.holdLock = false;
    if (dir && this.aim) {
      const step = this.hold.update(dir, dt);
      if (step) this.aim.move(step);
      return;
    }
    if (dir) {
      this.walk = null;
      if (this.holdLock) return;
      const step = this.hold.update(dir, dt);
      if (step) this.doAction({ kind: 'move', dir: step });
      return;
    }
    this.hold.update(null, dt);
    if (!this.walk) return;
    this.walkTimer -= dt;
    if (this.walkTimer > 0) return;
    this.walkTimer = WALK_EVERY;
    const next = this.walk.shift();
    const h = this.s.hero.pos;
    if (!next || dist(next, h) !== 1 || walkBlocked(this.s, next)) { this.walk = null; return; }
    if (!this.doAction({ kind: 'move', dir: { x: next.x - h.x, y: next.y - h.y }, plain: true })) this.walk = null;
    if (this.walk && !this.walk.length) this.walk = null;
  }

  private frame(dt: number): void {
    const s = this.s;
    this.controls.pollPad();
    if (!s.outcome) this.input(dt);
    this.rt!.update(dt);
    const target = this.api.sim.autoTarget();
    const chance = target ? this.api.sim.shotChance(target) : null;
    this.hud.update(s, target && chance !== null ? { id: target, chance } : null, dt);
    const w = activeWeapon(s.hero.gear);
    const melee = !w || WEAPONS[w.group].melee;
    const other = s.hero.gear.hands[s.hero.gear.active === 0 ? 1 : 0];
    this.touch?.setSwap(other?.group);
    this.touch?.setFire(melee ? other?.group : w?.group, melee ? '교체' : '사격', melee ? '원거리로' : canFire(s) && chance !== null ? `${Math.round(chance * 100)}%` : w ? weaponState(w, s.hero.gear.arrows) || '-' : '-');
    this.touch?.setPotions(s.hero.gear.belt.potion);
    if (this.aim) this.touch?.setFire(undefined, '던지기', ITEM_NAME[this.aim.item]);
    this.belt.update(s, this.aim?.item ?? null);
    this.drawAim();
    if (s.outcome && !this.ended) {
      this.ended = true;
      this.endTimer = setTimeout(() => this.api.end(), 1200);
    }
  }

  unmount(): void {
    this.gone = true;
    clearTimeout(this.endTimer);
    cancelAnimationFrame(this.raf);
    for (const c of this.cleanup) c();
    this.zoom?.dispose();
    this.touch?.dispose();
    this.rt?.dispose();
    delete (window as unknown as { __PROJR_GRID__?: unknown }).__PROJR_GRID__;
    this.el.remove();
  }
}
