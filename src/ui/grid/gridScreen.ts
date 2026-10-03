import { loadPixel, savePixel } from '../../app/gridPreferences';
import { exploreTarget } from '../../sim/grid/explore';
import type { Screen } from '../../app/router';
import { HoldRepeat, interruption, quantize8 } from '../../app/input/gridInput';
import { shootable, walkBlocked } from '../../sim/grid/actions';
import { activeWeapon } from '../../sim/grid/gear';
import { WEAPONS, type BeltItem } from '../../sim/grid/items';
import { canFire } from '../../sim/grid/weapons';
import { GridBag } from './gridBag';
import { LevelUpPanel } from './levelUp';
import { UpgradePanel } from './upgradePanel';
import { GridBelt, THROWN } from './gridBelt';
import { ThrowAim } from './throwAim';
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
import { attachFoePress } from './foePress';
import '../styles/grid.css';
export interface GridApi { sim: GridSim; lib: UalLibrary; kit: DungeonKit; end(): void; afterAction?(): void; fatal(e: unknown): void }
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
  private bag: GridBag | null = null;
  private levelUp: { panel: LevelUpPanel | UpgradePanel; offer: unknown } | null = null;
  private readonly belt = new GridBelt((it) => this.controls.push(it));
  private readonly throwing = new ThrowAim(() => this.s, (c) => this.controls.push(c), (a) => this.doAction(a), (cells, ok) => this.rt?.showAim(cells, ok));
  private cleanup: (() => void)[] = [];
  private walk: Cell[] | null = null;
  private walkTimer = 0;
  private exploring = false;
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
    const cancelWalk = () => this.stopWalk();
    this.el.addEventListener('pointerdown', cancelWalk, true);
    window.addEventListener('keydown', cancelWalk);
    this.cleanup.push(() => window.removeEventListener('keydown', cancelWalk));
    const stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    const mobile = isTouchDevice();
    try {
      this.rt = new GridRuntime(stage, this.api.sim, this.api.lib, this.api.kit, mobile, (e) => this.hud.cue(e));
    } catch (e) {
      return this.api.fatal(e);
    }
    this.el.appendChild(this.hud.el);
    this.el.append(this.belt.el, this.throwing.bar);
    this.touch = new GridTouch((c) => this.controls.push(c), mobile);
    this.el.appendChild(this.touch.el);
    const rt = this.rt;
    this.cleanup.push(attachFoePress(this.el, () => this.s, (x, y) => rt.cellAt(x, y), (id) => {
      // a long press only inspects: the held stick under the thumb lets go so the hero does not walk off
      if (!this.levelUp && !this.bag && !this.s.outcome && !this.throwing.aim) { this.stopWalk(); this.touch?.releaseStick(); this.s.hero.target = id; }
    }));
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
  private stopWalk(): void { this.walk = null; this.exploring = false; }
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
    this.api.afterAction?.();
    if (!ev.length || (ev.length === 1 && ev[0]!.type === 'blocked')) return false;
    this.rt?.apply(ev, t0);
    const stop = interruption([...this.visibleFoes()].some((id) => !before.has(id)), s.hero.hp < hp);
    if (stop.walk) this.stopWalk();
    if (stop.hold) { this.hold.reset(); this.holdLock = true; }
    return true;
  }
  private command(c: GridCmd): void {
    const s = this.s;
    if (c === 'explore') { this.throwing.command('cancel', null); this.exploring = true; return; }
    if (c === 'stairs') {
      this.throwing.command('cancel', null);
      if (s.map.stairs && s.seen[idx(s.map, s.map.stairs)]) { this.walkTo(s.map.stairs); this.walk?.pop(); }
      return;
    }
    const item = (THROWN as string[]).includes(c) ? (c as Exclude<BeltItem, 'potion'>) : null;
    if (this.throwing.command(c, item)) return;
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
    if (c === 'search') this.doAction({ kind: 'search' });
  }
  private toggleBag(): void {
    if (this.bag) { this.bag.el.remove(); this.bag = null; return; }
    this.bag = new GridBag(() => this.s.hero.gear, (a) => { this.doAction(a); }, () => this.toggleBag(), { state: () => this.s, throwPotion: (p) => { this.toggleBag(); this.throwing.start(`potion:${p}`); } });
    this.el.appendChild(this.bag.el);
  }
  /** A pending upgrade or engraving choice holds the game until it is made (or passed up); true while it is open. */
  private showLevelUp(): boolean {
    const upgrade = this.s.upgrades[0];
    const offer = upgrade ?? this.s.offers[0];
    if (this.levelUp && this.levelUp.offer === offer) return true;
    this.levelUp?.panel.el.remove();
    this.levelUp = null;
    if (!offer) return false;
    this.stopWalk();
    const act = (a: GAction) => { this.doAction(a); };
    const panel = upgrade ? new UpgradePanel(upgrade, this.s.hero.level, act)
      : new LevelUpPanel(this.s.offers[0]!, this.s.hero.suit, this.s.hero.level, act);
    this.levelUp = { panel, offer };
    this.el.appendChild(panel.el);
    return true;
  }
  private onTap(x: number, y: number): void {
    this.stopWalk();
    const s = this.s;
    const c = this.rt?.cellAt(x, y);
    if (!c || this.levelUp) return;
    if (this.throwing.aim) { this.throwing.tap(c); return; }
    // a tap on the hero searches around
    if (same(c, s.hero.pos)) { this.doAction({ kind: 'search' }); return; }
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
    this.walk = findPath(s.map, s.hero.pos, c, (p) => walkBlocked(s, p) || (this.exploring && !s.seen[idx(s.map, p)]));
    this.walkTimer = 0;
  }
  private input(dt: number): void {
    const cmd = this.controls.take();
    if (this.showLevelUp()) return;
    if (this.bag && cmd !== 'bag') { this.bag.render(); return; }
    if (cmd) { this.stopWalk(); this.command(cmd); return; }
    const v = this.touch?.vector();
    this.stickDir = v ? quantize8(v.x, v.y, 0.35, this.stickDir) : null;
    const dir = this.controls.dir() ?? this.stickDir;
    if (!dir) this.holdLock = false;
    if (dir && this.throwing.aim) {
      const step = this.hold.update(dir, dt);
      if (step) this.throwing.aim.move(step);
      return;
    }
    if (dir) {
      this.stopWalk();
      if (this.holdLock) return;
      const step = this.hold.update(dir, dt);
      if (step) this.doAction({ kind: 'move', dir: step });
      return;
    }
    this.hold.update(null, dt);
    if (!this.walk && this.exploring) {
      const target = exploreTarget(this.s);
      if (!target || same(target, this.s.hero.pos)) { this.stopWalk(); this.hud.message('더 갈 곳이 없다'); }
      else this.walkTo(target);
    }
    if (!this.walk) return;
    this.walkTimer -= dt;
    if (this.walkTimer > 0) return;
    this.walkTimer = WALK_EVERY;
    const next = this.walk.shift();
    const h = this.s.hero.pos;
    if (this.exploring && next && this.s.map.stairs && same(next, this.s.map.stairs)) { this.stopWalk(); return; }
    if (!next || dist(next, h) !== 1 || walkBlocked(this.s, next)) { this.stopWalk(); return; }
    if (!this.doAction({ kind: 'move', dir: { x: next.x - h.x, y: next.y - h.y }, plain: true })) this.stopWalk();
    if (this.walk && !this.walk.length) this.walk = null;
  }
  private frame(dt: number): void {
    const s = this.s;
    this.controls.pollPad();
    if (!s.outcome) this.input(dt);
    this.rt!.update(dt);
    const target = this.api.sim.autoTarget();
    const chance = target ? this.api.sim.shotChance(target) : null;
    const inspected = s.foes.find((f) => f.id === s.hero.target && f.alive && s.visible.has(idx(s.map, f.pos)))?.id ?? target;
    this.hud.update(s, inspected ? { id: inspected, chance: this.api.sim.shotChance(inspected) } : null);
    const w = activeWeapon(s.hero.gear);
    const melee = !w || WEAPONS[w.group].melee;
    const other = s.hero.gear.hands[s.hero.gear.active === 0 ? 1 : 0];
    this.touch?.setSwap(other?.group, other?.name);
    this.touch?.setFire(melee ? other?.group : w?.group, melee ? '교체' : `사격 ${w?.name ?? ''}`, melee ? '원거리로' : w ? `${weaponState(w, s.hero)}${canFire(s) && chance !== null ? ` · ${Math.round(chance * 100)}%` : ''}` : '-');
    this.touch?.setStairs(!!s.map.stairs && !!s.seen[idx(s.map, s.map.stairs)]);
    this.touch?.setPotions(s.hero.gear.belt.potion);
    if (this.throwing.aim) this.touch?.setFire(undefined, '던지기', this.throwing.label());
    this.belt.update(s, this.throwing.item);
    this.throwing.draw();
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
