import { checkRunEnd } from './battleNode';
import { resolveEvent } from './events';
import { recruit } from './recruit';
import { currentNode } from './state';
import type { Candidate, EventView, RunState, Slot } from './types';

/**
 * Save points that keep reloads honest: every resolved node action closes `pending` in the same state
 * that is saved, so reloading can never replay a reward.
 */
export function chooseEvent(run: RunState, view: EventView, choiceId: string): ReturnType<typeof resolveEvent> {
  const out = resolveEvent(run, view, choiceId);
  return { ...out, run: { ...out.run, pending: undefined } };
}

export function recruitAndClose(run: RunState, c: Candidate): RunState {
  return { ...recruit(run, c), pending: undefined };
}

/** Marks the node's battle as started; a reload from here counts as a retreat. */
export function beginBattle(run: RunState, formation: Record<string, Slot>): RunState {
  const node = currentNode(run);
  if (!node) throw new Error('no current node');
  return { ...run, formation, pending: { nodeId: node.id, inBattle: true } };
}

export type ResumeTarget = 'map' | 'node' | 'abandonedBattle' | 'end';

export function resumeTarget(run: RunState): ResumeTarget {
  if (run.status !== 'active') return 'end';
  if (!run.pending || !currentNode(run)) return 'map';
  return run.pending.inBattle ? 'abandonedBattle' : 'node';
}

const RETREAT_GOLD = 0.7;
const RETREAT_INJURY = 2;

/** Settles a battle the player left mid-fight (reload/close) exactly like a retreat. */
export function abandonBattle(run: RunState): RunState {
  const node = currentNode(run);
  const deployed = new Set(Object.keys(run.formation));
  const mercs = run.roster.mercs.map((m) => (deployed.has(m.id) ? { ...m, injury: Math.max(m.injury, RETREAT_INJURY) } : m));
  let next: RunState = { ...run, gold: Math.floor(run.gold * RETREAT_GOLD), roster: { ...run.roster, mercs }, pending: undefined };
  if (node?.type === 'boss') next = { ...next, status: 'lost' };
  return { ...next, status: checkRunEnd(next) };
}
