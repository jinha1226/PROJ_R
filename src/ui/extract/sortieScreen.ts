import type { Screen } from '../../app/router';
import { Input } from '../../app/input/input';
import { cameraTurn } from '../../app/input/sortieInput';
import type { Loadout } from '../../sim/extract/loadout';
import type { Region } from '../../sim/extract/regionTypes';
import type { Mercenary } from '../../sim/roster/types';
import { idleInput, type HeroInput } from '../../sim/world/worldSim';
import { heroUnit } from '../../sim/world/worldState';
import type { AssetLibrary } from '../../view/actors/assets';
import type { EnvLibrary } from '../../view/explore/envAssets';
import { guardFrame } from '../screens/loopGuard';
import { BagPanel } from './bagPanel';
import { Hud } from './hud';
import { isTouchDevice, TouchControls } from './touchControls';
import { WorldRuntime } from './worldRuntime';
import '../styles/extract.css';

export interface SortieApi {
  region: Region;
  hero: Mercenary;
  loadout: Loadout;
  seed: number;
  lib: AssetLibrary;
  env: EnvLibrary;
  end(outcome: 'extracted' | 'downed', loadout: Loadout, xp: number): void;
  abandon(): void;
  fatal(e: unknown): void;
}

/** The sortie: drive the hero, loot, watch the clock, get out alive. */
export class SortieScreen implements Screen {
  private readonly el = document.createElement('div');
  private rt: WorldRuntime | null = null;
  private readonly input = new Input();
  private readonly hud = new Hud();
  private touch: TouchControls | null = null;
  private panel: BagPanel | null = null;
  private detach: (() => void) | null = null;
  private raf = 0;
  private gone = false;
  private auto = false;
  private paused = false;
  private ended = false;
  private mouseAttack = false;
  private cursor = 0;
  private latched: Pick<HeroInput, 'skill1' | 'skill2' | 'ult' | 'interact' | 'quick'> = { skill1: false, skill2: false, ult: false, interact: false, quick: null };

  constructor(private readonly api: SortieApi) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen sortie';
    this.el.dataset.testid = 'sortie';
    this.el.innerHTML = '<div class="sortie-stage"></div><div class="sortie-portrait">가로로 돌려 주세요</div>';
    root.appendChild(this.el);
    const stage = this.el.querySelector<HTMLElement>('.sortie-stage')!;
    const mobile = isTouchDevice();
    try {
      this.rt = new WorldRuntime(stage, this.api.region, this.api.hero, this.api.loadout, this.api.seed, this.api.lib, this.api.env, mobile);
    } catch (e) {
      return this.api.fatal(e);
    }
    this.el.appendChild(this.hud.el);
    if (mobile) {
      this.touch = new TouchControls(this.input, () => this.rt!.sim.w.hero.loadout.quick.length);
      this.el.appendChild(this.touch.el);
    }
    this.detach = this.input.attach(window);
    stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.mouseAttack = true; });
    window.addEventListener('pointerup', this.onPointerUp);
    this.debugHook();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (guardFrame(() => this.frame(dt), (err) => this.api.fatal(err)) && !this.gone) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private readonly onPointerUp = (): void => { this.mouseAttack = false; };

  private frame(dt: number): void {
    const rt = this.rt!;
    const s = this.input.poll();
    if (s.menu && !this.panel) this.openPanel();
    else if ((s.menu || s.cancel) && this.panel) this.closePanel();
    if (s.toggleManual) this.auto = !this.auto;
    const turn = cameraTurn(s);
    if (turn) rt.cam.rotateStep(turn);
    const looting = !!this.panel;
    // one-shot presses wait for the next sim tick (a frame may run zero ticks)
    const p = this.latched;
    if (!looting) {
      p.skill1 ||= s.skill1; p.skill2 ||= s.skill2; p.ult ||= s.ult; p.interact ||= s.pick;
      if (s.quick !== null) p.quick = s.quick;
    }
    const move = looting ? { x: 0, y: 0 } : rt.worldMove(s.move.x, s.move.y);
    const attack = !looting && (s.attackHeld || this.mouseAttack);
    rt.update(dt, () => {
      const once = this.latched;
      this.latched = { skill1: false, skill2: false, ult: false, interact: false, quick: null };
      return { ...idleInput(), ...once, move, attack, auto: this.auto };
    }, this.paused);
    const w = rt.sim.w;
    const near = rt.sim.nearby();
    this.hud.update(w, near, this.auto, dt);
    this.touch?.setPickVisible(!!near);
    for (; this.cursor < w.events.length; this.cursor++) {
      const ev = w.events[this.cursor]!;
      if (ev.type === 'loot' && !this.panel) this.openPanel(String(ev.data?.id));
    }
    if (this.panel && !this.paused) this.panel.render();
    if (w.outcome && !this.ended) {
      this.ended = true;
      const out = w.outcome;
      setTimeout(() => this.api.end(out, w.hero.loadout, w.xp), 900);
    }
  }

  private openPanel(source?: string): void {
    const rt = this.rt!;
    this.paused = !source;
    this.panel = new BagPanel({
      sim: rt.sim, source, close: () => this.closePanel(),
      abandon: source ? undefined : () => this.api.abandon(),
    });
    this.el.appendChild(this.panel.el);
  }

  private closePanel(): void {
    this.panel?.el.remove();
    this.panel = null;
    this.paused = false;
  }

  private debugHook(): void {
    (window as unknown as { __PROJR_WORLD__: unknown }).__PROJR_WORLD__ = {
      tick: () => this.rt?.sim.w.b.tick ?? 0,
      teleport: (x: number, y: number) => { if (this.rt) heroUnit(this.rt.sim.w).pos = { x, y }; },
      finish: (o: 'extracted' | 'downed') => { if (this.rt) this.rt.sim.w.outcome = o; },
      /** debug/e2e: run the sim forward synchronously (slow software renderers in CI) */
      advance: (ticks: number) => { for (let i = 0; i < ticks && this.rt && !this.rt.sim.w.outcome; i++) this.rt.sim.step({ ...idleInput(), auto: this.auto }); },
      state: () => this.rt?.sim.w,
    };
  }

  unmount(): void {
    this.gone = true;
    cancelAnimationFrame(this.raf);
    this.detach?.();
    window.removeEventListener('pointerup', this.onPointerUp);
    this.touch?.dispose();
    this.rt?.dispose();
    delete (window as unknown as { __PROJR_WORLD__?: unknown }).__PROJR_WORLD__;
    this.el.remove();
  }
}
