import type { Screen } from '../../app/router';
import type { BattleSetup, Outcome } from '../../sim/battle/types';
import type { AssetLibrary } from '../../view/actors/assets';
import { BattleLog } from '../hud/battleLog';
import { Controls } from '../hud/controls';
import { InspectPanel } from '../hud/inspectPanel';
import { showResult } from '../hud/resultOverlay';
import { BattleRuntime, unitName } from './battleRuntime';
import { guardFrame } from './loopGuard';

export interface BattleScreenActions {
  retry(): void;
  back(): void;
  fatal(err: unknown): void;
}

interface DebugHook {
  tick(): number;
  outcome(): Outcome | null;
  speed(s: 0 | 1 | 2 | 4): void;
}

export class BattleScreen implements Screen {
  private rt: BattleRuntime | null = null;
  private raf = 0;
  private parts: { dispose(): void }[] = [];

  constructor(private readonly setup: BattleSetup, private readonly lib: AssetLibrary, private readonly act: BattleScreenActions) {}

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
        log: (e) => log?.add(e),
        onEnd: (o) => this.onEnd(el, o),
        onBerserk: () => el.classList.add('berserk'),
      });
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
    const inspect = new InspectPanel(el, () => units.filter((u) => !u.summoned).map((u) => u.setup), unitName);
    const controls = new Controls(el, {
      getSpeed: () => rt.player.speed,
      setSpeed: (s) => { rt.player.speed = s; },
      retreat: () => rt.player.retreat(),
    });
    this.parts = [log, inspect, controls];
    stage.addEventListener('click', (e) => {
      const id = rt.pick(e.clientX, e.clientY);
      if (id) inspect.select(id);
    });
    (window as unknown as { __PROJR__: DebugHook }).__PROJR__ = {
      tick: () => rt.battle.state.tick,
      outcome: () => rt.battle.outcome,
      speed: (s) => { rt.player.speed = s; },
    };
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ok = guardFrame(() => {
        rt.update(dt);
        inspect.update((id) => rt.snap(id));
      }, (e) => this.act.fatal(e));
      if (ok) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private onEnd(el: HTMLElement, outcome: Outcome): void {
    const rt = this.rt;
    if (!rt) return;
    setTimeout(() => showResult(el, outcome, rt.battle.state.units, (u) => unitName(u.setup), this.act), 900);
  }

  unmount(): void {
    cancelAnimationFrame(this.raf);
    for (const p of this.parts) p.dispose();
    this.rt?.dispose();
    this.rt = null;
  }
}
