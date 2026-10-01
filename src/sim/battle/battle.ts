import { createState } from './setup';
import { makeSnapshot } from './snapshot';
import { checkOutcome } from './rules';
import type { BattleCommand, BattleEvent, BattleSetup, BattleState, Outcome, Snapshot, StepResult } from './types';

export class Battle {
  readonly state: BattleState;
  private last: Snapshot;

  constructor(setup: BattleSetup) {
    this.state = createState(setup);
    this.last = makeSnapshot(this.state);
  }

  get outcome(): Outcome | null {
    return this.state.outcome;
  }

  command(cmd: BattleCommand): void {
    this.state.pending.push(cmd);
  }

  step(): StepResult {
    const s = this.state;
    if (s.outcome) return { snapshot: this.last, events: [] };
    s.events = [];
    checkOutcome(s);
    s.tick++;
    this.last = makeSnapshot(s);
    return { snapshot: this.last, events: s.events };
  }
}

export interface HeadlessResult {
  outcome: Outcome;
  ticks: number;
  events: BattleEvent[];
  final: Snapshot;
}

export function runHeadless(setup: BattleSetup, commands: { tick: number; cmd: BattleCommand }[] = []): HeadlessResult {
  const b = new Battle(setup);
  const events: BattleEvent[] = [];
  let final = makeSnapshot(b.state);
  while (!b.outcome) {
    for (const c of commands) if (c.tick === b.state.tick) b.command(c.cmd);
    const r = b.step();
    events.push(...r.events);
    final = r.snapshot;
  }
  return { outcome: b.outcome!, ticks: b.state.tick, events, final };
}
