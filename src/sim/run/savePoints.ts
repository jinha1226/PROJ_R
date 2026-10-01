import { checkRunEnd } from './battleNode';
import { resolveEvent } from './events';
import { recruit } from './recruit';
import type { Candidate, EventView, RunState, Slot } from './types';

/**
 * Save points that keep reloads honest: every resolved action closes its volatile state in the same
 * snapshot that is saved, so reloading can never replay a reward.
 */
export function chooseEvent(run: RunState, view: EventView, choiceId: string): ReturnType<typeof resolveEvent> {
  const out = resolveEvent(run, view, choiceId);
  return { ...out, run: { ...out.run, pending: undefined } };
}

export function recruitAndClose(run: RunState, c: Candidate): RunState {
  return { ...recruit(run, c), pending: undefined };
}

/** Marks a battle as started; a reload from here counts as a retreat. */
export function beginBattle(run: RunState, formation: Record<string, Slot>): RunState {
  return { ...run, formation, pending: { inBattle: true } };
}

export type ResumeTarget = 'week' | 'abandonedBattle' | 'end';

export function resumeTarget(run: RunState): ResumeTarget {
  if (run.status !== 'active') return 'end';
  return run.pending?.inBattle ? 'abandonedBattle' : 'week';
}

const RETREAT_GOLD = 0.7;
const RETREAT_INJURY = 2;

/** Settles a battle the player left mid-fight (reload/close) exactly like a retreat. */
export function abandonBattle(run: RunState): RunState {
  const deployed = new Set(Object.keys(run.formation));
  const mercs = run.roster.mercs.map((m) => (deployed.has(m.id) ? { ...m, injury: Math.max(m.injury, RETREAT_INJURY) } : m));
  let next: RunState = { ...run, gold: Math.floor(run.gold * RETREAT_GOLD), roster: { ...run.roster, mercs }, pending: undefined };
  if (run.phase === 'boss') next = { ...next, status: 'lost' };
  return { ...next, status: checkRunEnd(next) };
}
