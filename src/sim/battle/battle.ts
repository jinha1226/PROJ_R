import '../personality';
import { createState } from './setup';
import { makeSnapshot } from './snapshot';
import { checkOutcome, processCommands, updateRules } from './rules';
import { updateRescue } from './rescue';
import { runReactors } from './reactors';
import { advanceActions, tickCooldowns } from './actions';
import { decide } from './ai/decide';
import { updateEngagement } from './engagement';
import { moveUnits } from './movement';
import { updateProjectiles } from './projectiles';
import { tickTags } from './tags';
import { updateTelegraphs } from './telegraphs';
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
    processCommands(s);
    if (s.outcome) return this.finish();
    updateRules(s);
    tickTags(s);
    tickCooldowns(s);
    decide(s);
    advanceActions(s);
    updateTelegraphs(s);
    updateProjectiles(s);
    moveUnits(s);
    updateEngagement(s);
    updateRescue(s);
    runReactors(s);
    checkOutcome(s);
    return this.finish();
  }

  private finish(): StepResult {
    this.state.tick++;
    this.last = makeSnapshot(this.state);
    return { snapshot: this.last, events: this.state.events };
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
