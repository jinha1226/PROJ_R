import type { Battle } from '../../sim/battle/battle';
import { DT } from '../../sim/battle/constants';
import { makeSnapshot } from '../../sim/battle/snapshot';
import type { Snapshot, StepResult } from '../../sim/battle/types';

export type Speed = 0 | 1 | 2 | 4;

export interface Frame {
  prev: Snapshot;
  curr: Snapshot;
  alpha: number;
}

const MAX_FRAME_DT = 0.1;

/** Drives the fixed-tick sim from variable frame times, at most 8 ticks per frame. */
export class BattlePlayer {
  speed: Speed = 1;
  readonly maxStepsPerFrame = 8;
  private acc = 0;
  private prev: Snapshot;
  private curr: Snapshot;

  constructor(readonly battle: Battle, private readonly onStep: (r: StepResult) => void) {
    this.prev = this.curr = makeSnapshot(battle.state);
  }

  update(dtSec: number): Frame {
    this.acc += Math.min(dtSec, MAX_FRAME_DT) * this.speed;
    // commands (retreat) must take effect even while paused
    if (this.speed === 0 && this.battle.state.pending.length && !this.battle.outcome) this.acc = DT;
    let steps = 0;
    while (this.acc >= DT - 1e-9 && steps < this.maxStepsPerFrame && !this.battle.outcome) {
      const r = this.battle.step();
      this.prev = this.curr;
      this.curr = r.snapshot;
      this.acc -= DT;
      steps++;
      this.onStep(r);
    }
    if (steps >= this.maxStepsPerFrame || this.battle.outcome) this.acc = Math.min(this.acc, DT * 0.999);
    return { prev: this.prev, curr: this.curr, alpha: Math.max(0, Math.min(0.999, this.acc / DT)) };
  }

  retreat(): void {
    this.battle.command({ type: 'retreat' });
  }
}
