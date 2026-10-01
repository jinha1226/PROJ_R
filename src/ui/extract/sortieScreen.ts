import type { Screen } from '../../app/router';
import { Input } from '../../app/input/input';
import { cameraTurn } from '../../app/input/sortieInput';
import type { Stack } from '../../sim/extract/inventory';
import type { SortieEnd } from '../../sim/extract/companyTypes';
import type { Member } from '../../sim/world/party';
import type { Region } from '../../sim/extract/regionTypes';
import { idleInput, WorldSim, type HeroInput } from '../../sim/world/worldSim';
import { partyUnits } from '../../sim/world/party';
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
  members: Member[];
  pack: Stack[];
  pouch: Stack | null;
  seed: number;
  lib: AssetLibrary;
  env: EnvLibrary;
  end(end: SortieEnd): void;
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
  private paused = false;
  private ended = false;
  private mouseAttack = false;
  private cursor = 0;
  private endTimer: ReturnType<typeof setTimeout> | undefined;
  private latched: Pick<HeroInput, 'focus' | 'retreat' | 'regroup' | 'interact' | 'quick'> = { focus: false, retreat: false, regroup: false, interact: false, quick: null };

  constructor(private readonly api: SortieApi) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen sortie';
    this.el.dataset.testid = 'sortie';
    this.el.innerHTML = '<div class="sortie-stage"></div><div class="sortie-portrait">가로로 돌려 주세요</div>';
    root.appendChild(this.el);
    const stage = this.el.querySelector<HTMLElement>('.sortie-stage')!;
    const mobile = isTouchDevice();
    try {
      this.rt = new WorldRuntime(stage, WorldSim.party(this.api.region, this.api.members, this.api.pack, this.api.pouch, this.api.seed), this.api.lib, this.api.env, mobile);
    } catch (e) {
      return this.api.fatal(e);
    }
    this.el.appendChild(this.hud.el);
    if (mobile) {
      this.touch = new TouchControls(this.input);
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
    if (s.menu && !this.panel && !rt.sim.w.outcome) this.openPanel();
    else if ((s.menu || s.cancel) && this.panel) this.closePanel();
    const turn = cameraTurn(s);
    if (turn) rt.cam.rotateStep(turn);
    const looting = !!this.panel;
    // one-shot presses wait for the next sim tick (a frame may run zero ticks)
    const p = this.latched;
    if (!looting) {
      p.focus ||= s.focus || this.hud.takeOrder('focus'); p.retreat ||= s.retreat || this.hud.takeOrder('retreat'); p.regroup ||= s.regroup || this.hud.takeOrder('regroup');
      p.interact ||= s.pick || this.hud.takeOrder('pick');
      if (s.quick !== null) p.quick = s.quick;
    }
    const move = looting ? { x: 0, y: 0 } : rt.worldMove(s.move.x, s.move.y);
    rt.update(dt, () => {
      const once = this.latched;
      this.latched = { focus: false, retreat: false, regroup: false, interact: false, quick: null };
      return { ...idleInput(), ...once, move };
    }, this.paused);
    const w = rt.sim.w;
    const near = rt.sim.nearby();
    this.hud.update(w, near, dt);
    this.touch?.setPickVisible(!!near);
    for (; this.cursor < w.events.length; this.cursor++) {
      const ev = w.events[this.cursor]!;
      if (ev.type === 'loot' && !this.panel && !w.outcome) this.openPanel(String(ev.data?.id));
    }
    if (this.panel && !this.paused) this.panel.render();
    if (w.outcome && !this.ended) {
      this.ended = true;
      const out = w.outcome;
      const end = rt.sim.end();
      this.endTimer = setTimeout(() => this.api.end(end), out === 'extracted' ? 900 : 1600);
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
      teleport: (x: number, y: number) => {
        if (!this.rt) return;
        // the whole party moves together (only those inside an extraction point get out)
        partyUnits(this.rt.sim.w).forEach((u, i) => { u.pos = { x: x - (i ? 0.9 : 0) * Math.cos(i * 2.1), y: y + (i ? 0.9 : 0) * Math.sin(i * 2.1) }; });
        this.rt.sim.w.party.trail = [];
      },
      finish: (o: 'extracted' | 'failed') => { if (this.rt) this.rt.sim.w.outcome = o === 'extracted' ? o : 'failed'; },
      /** debug/e2e: run the sim forward synchronously (slow software renderers in CI) */
      advance: (ticks: number) => { for (let i = 0; i < ticks && this.rt && !this.rt.sim.w.outcome; i++) this.rt.sim.step(idleInput()); },
      state: () => this.rt?.sim.w,
    };
  }

  unmount(): void {
    this.gone = true;
    clearTimeout(this.endTimer);
    cancelAnimationFrame(this.raf);
    this.detach?.();
    window.removeEventListener('pointerup', this.onPointerUp);
    this.touch?.dispose();
    this.rt?.dispose();
    delete (window as unknown as { __PROJR_WORLD__?: unknown }).__PROJR_WORLD__;
    this.el.remove();
  }
}
