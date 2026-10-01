import type { BattleEvent, BattleState } from './types';

/** Reacts to the events emitted during the current tick (personality, relationships, ...). */
export type Reactor = (s: BattleState, events: readonly BattleEvent[]) => void;

export const reactors: Reactor[] = [];

export function registerReactor(r: Reactor): void {
  reactors.push(r);
}

/** Each reactor sees only the events that existed before reactors ran this tick. */
export function runReactors(s: BattleState): void {
  if (reactors.length === 0) return;
  const snapshot = s.events.slice();
  for (const r of reactors) r(s, snapshot);
}
