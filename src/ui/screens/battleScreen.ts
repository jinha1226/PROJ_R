import type { Screen } from '../../app/router';
import type { BattleEvent, BattleSetup, BattleState, Outcome } from '../../sim/battle/types';
import { describeRelations } from '../hud/relationText';
import { buildStory } from '../hud/story';
import type { AssetLibrary } from '../../view/actors/assets';
import { BattleLog } from '../hud/battleLog';
import { Controls } from '../hud/controls';
import { InspectPanel } from '../hud/inspectPanel';
import { showResult } from '../hud/resultOverlay';
import { BattleRuntime, unitName, type RoomArena } from './battleRuntime';
import { guardFrame } from './loopGuard';
import { attachCameraInput } from '../../view/scene/cameraInput';

export interface BattleScreenActions {
  retry(): void;
  back(): void;
  fatal(err: unknown): void;
  /** company mode: the result screen shows a single "continue" that hands over the final state */
  onContinue?(state: BattleState, events: readonly BattleEvent[]): void;
}

interface DebugHook {
  finish(): void;
  tick(): number;
  outcome(): Outcome | null;
  speed(s: 0 | 1 | 2 | 4): void;
}

export class BattleScreen implements Screen {
  private rt: BattleRuntime | null = null;
  private raf = 0;
  private parts: { dispose(): void }[] = [];
  private readonly events: BattleEvent[] = [];

  constructor(
    private readonly setup: BattleSetup, private readonly lib: AssetLibrary, private readonly act: BattleScreenActions,
    private readonly arena?: RoomArena,
  ) {}

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen battle';
    root.appendChild(el);
    const stage = document.createElement('div');
    stage.className = 'battle-stage';
    el.appendChild(stage);
    let log: BattleLog | null = null;
    try {
      this.rt = new BattleRuntime(stage, this.setup, this.lib, {
        log: (e) => {
          this.events.push(e);
          log?.add(e);
        },
        onEnd: (o) => this.onEnd(el, o),
        onBerserk: () => el.classList.add('berserk'),
      }, this.arena);
    } catch (err) {
      this.act.fatal(err);
      return;
    }
    const rt = this.rt;
    const units = rt.battle.state.units;
    const nameById = (id?: string) => {
      const u = units.find((x) => x.id === id);
      return u ? unitName(u.setup) : '';
    };
    log = new BattleLog(el, nameById);
    const inspect = new InspectPanel(el, () => units.filter((u) => !u.summoned).map((u) => u.setup), unitName, (id) => {
      const u = units.find((x) => x.id === id);
      return u ? describeRelations(rt.battle.state, u, (x) => unitName(x.setup)) : [];
    });
    const controls = new Controls(el, {
      getSpeed: () => rt.player.speed,
      setSpeed: (s) => { rt.player.speed = s; },
      retreat: () => rt.player.retreat(),
      cameraAuto: () => rt.cam.resetAuto(),
      isCameraManual: () => rt.cam.mode === 'manual',
      setIntents: (on) => rt.setIntentsVisible(on),
    });
    const detachCamera = attachCameraInput(stage, rt.cam, (x, y) => {
      const id = rt.pick(x, y);
      if (id) inspect.select(id);
    });
    this.parts = [log, inspect, controls, { dispose: detachCamera }];
    (window as unknown as { __PROJR__: DebugHook }).__PROJR__ = {
      tick: () => rt.battle.state.tick,
      finish: () => rt.player.finish(),
      outcome: () => rt.battle.outcome,
      speed: (s) => { rt.player.speed = s; },
    };
    let last = performance.now();
    const loop = (now: number) => {
      // a frame's timestamp can come just before the moment the loop began: never a step back in time
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      const ok = guardFrame(() => {
        rt.selected = inspect.selectedId;
        rt.update(dt);
        inspect.update((id) => rt.snap(id));
        controls.tick();
      }, (e) => this.act.fatal(e));
      if (ok) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private onEnd(el: HTMLElement, outcome: Outcome): void {
    const rt = this.rt;
    if (!rt) return;
    const nameById = (id: string) => {
      const u = rt.battle.state.units.find((x) => x.id === id);
      return u ? unitName(u.setup) : id;
    };
    const story = buildStory(this.setup, this.events, nameById);
    const cont = this.act.onContinue;
    const actions = cont ? { retry: () => cont(rt.battle.state, this.events), back: () => cont(rt.battle.state, this.events), continueOnly: true } : this.act;
    setTimeout(() => showResult(el, outcome, rt.battle.state.units, (u) => unitName(u.setup), actions, story), 900);
  }

  unmount(): void {
    cancelAnimationFrame(this.raf);
    for (const p of this.parts) p.dispose();
    this.rt?.dispose();
    this.rt = null;
  }
}
