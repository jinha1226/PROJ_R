import { MAX_TICKS } from './constants';
import { emit } from './events';
import type { BattleState, Outcome } from './types';

function end(s: BattleState, outcome: Outcome): void {
  s.outcome = outcome;
  emit(s, { type: 'battle_end', data: { outcome } });
}

export function checkOutcome(s: BattleState): void {
  if (s.outcome) return;
  const enemiesLeft = s.units.some((u) => u.team === 'enemy' && u.alive);
  const alliesStanding = s.units.some((u) => u.team === 'ally' && u.alive && !u.downed);
  if (!enemiesLeft) end(s, 'victory');
  else if (!alliesStanding) end(s, 'defeat');
  else if (s.tick >= MAX_TICKS) end(s, 'defeat');
}
