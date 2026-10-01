import type { BattleEvent, BattleState } from './types';

export function emit(s: BattleState, e: Omit<BattleEvent, 'tick'>): void {
  s.events.push({ tick: s.tick, ...e });
}
