import type { Screen } from '../../app/router';
import { HoldRepeat, interruption, quantize8 } from '../../app/input/gridInput';
import { chestAt, shootable } from '../../sim/grid/actions';
import type { GridSim } from '../../sim/grid/gridSim';
import { findPath } from '../../sim/grid/path';
import { dist, idx, same, tileAt, walkable, type Cell, type GAction } from '../../sim/grid/types';
import type { UalLibrary } from '../../view/grid/ualActor';
import type { EnvLibrary } from '../../view/explore/envAssets';
import { GridRuntime } from '../../view/grid/gridRuntime';
import { watchLayout } from '../extract/orientation';
import { isTouchDevice } from '../extract/touchControls';
import { ZoomControl } from '../extract/zoomControl';
import { guardFrame } from '../screens/loopGuard';
import { GridControls, type GridCmd } from './gridControls';
import { GridHud } from './gridHud';
import { GridTouch } from './gridTouch';
import '../styles/grid.css';

export interface GridApi { sim: GridSim; lib: UalLibrary; env: EnvLibrary; end(): void; fatal(e: unknown): void }

const WALK_EVERY = 0.14;
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
      this.rt = new GridRuntime(stage, this.api.sim, this.api.lib, this.api.env, mobile, (e) => this.hud.cue(e));
    } catch (e) {
      return this.api.fatal(e);
    }
    this.el.appendChild(this.hud.el);
    if (mobile) {
      this.touch = new GridTouch((c) => this.controls.push(c));
      this.el.appendChild(this.touch.el);
    }
    const rt = this.rt;
    this.zoom = new ZoomControl({ setHeight: (h) => rt.setZoom(h) }, stage, () => this.touch?.releaseStick(),
      { key: 'projr.grid.zoom', defaults: { portrait: 18, landscape: 11 }, pad: '.gt-pad', stage: '.grid-stage' });
    this.el.appendChild(this.zoom.el);
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
    (window as unknown as { __PROJR_GRID__: unknown }).__PROJR_GRID__ = { state: () => this.s, act: (a: GAction) => this.doAction(a), walkTo: (c: Cell) => this.walkTo(c), walking: () => !!this.walk };
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
    if (c === 'next' || c === 'prev') {
      const list = shootable(s).sort((a, b) => dist(s.hero.pos, s.foes.find((f) => f.id === a)!.pos) - dist(s.hero.pos, s.foes.find((f) => f.id === b)!.pos));
      if (!list.length) return;
      const at = list.indexOf(this.api.sim.autoTarget() ?? '');
      s.hero.target = list[(at + (c === 'next' ? 1 : list.length - 1)) % list.length];
      return;
    }
    if (c === 'shoot') {
      if (!s.hero.loaded) { this.doAction({ kind: 'reload' }); return; }
      const target = this.api.sim.autoTarget();
      if (target) this.doAction({ kind: 'shoot', target });
      return;
    }
    this.doAction({ kind: c });
  }

  private onTap(x: number, y: number): void {
    const s = this.s;
    const c = this.rt?.cellAt(x, y);
    if (!c) return;
    const foe = s.foes.find((f) => f.alive && same(f.pos, c) && s.visible.has(idx(s.map, c)));
    if (foe) { s.hero.target = foe.id; return; }
    if (s.seen[idx(s.map, c)]) this.walkTo(c);
  }

  /** Walks along a path to a cell (tap on the floor); stops when something shows up. */
  private walkTo(c: Cell): void {
    const s = this.s;
    if (!walkable(tileAt(s.map, c))) return;
    this.walk = findPath(s.map, s.hero.pos, c, (p) => chestAt(s, p)?.opened === false || s.foes.some((f) => f.alive && same(f.pos, p)));
    this.walkTimer = 0;
  }

  private input(dt: number): void {
    const cmd = this.controls.take();
    if (cmd) { this.walk = null; this.command(cmd); return; }
    const v = this.touch?.vector();
    this.stickDir = v ? quantize8(v.x, v.y, 0.35, this.stickDir) : null;
    const dir = this.controls.dir() ?? this.stickDir;
    if (!dir) this.holdLock = false;
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
    if (!next || dist(next, h) !== 1 || this.s.foes.some((f) => f.alive && same(f.pos, next))) { this.walk = null; return; }
    if (!this.doAction({ kind: 'move', dir: { x: next.x - h.x, y: next.y - h.y } })) this.walk = null;
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
    this.touch?.setFire(!s.hero.loaded ? '장전' : target ? '사격' : '사격', !s.hero.loaded ? `볼트 ${s.hero.bolts}` : chance !== null ? `${Math.round(chance * 100)}%` : '-');
    this.touch?.setPotions(s.hero.potions);
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
