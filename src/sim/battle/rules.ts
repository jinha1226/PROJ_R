import { BERSERK_STEP_TICKS, BERSERK_TICK, MAX_TICKS } from './constants';
import { emit } from './events';
import type { BattleState, Outcome } from './types';

function end(s: BattleState, outcome: Outcome): void {
  s.outcome = outcome;
  emit(s, { type: 'battle_end', data: { outcome } });
}

export function processCommands(s: BattleState): void {
  for (const cmd of s.pending) if (cmd.type === 'retreat' && !s.outcome) end(s, 'retreat');
  s.pending = [];
}

export function updateRules(s: BattleState): void {
  if (s.tick >= BERSERK_TICK) {
    const mult = 1.5 + 0.25 * Math.floor((s.tick - BERSERK_TICK) / BERSERK_STEP_TICKS);
    if (mult !== s.berserkMult) {
      s.berserkMult = mult;
      emit(s, { type: 'berserk', data: { mult } });
    }
  }
  for (const u of s.units) {
    const phase = u.setup.phases?.[u.phaseIndex];
    if (!u.alive || !phase || u.hp / u.maxHp >= phase.hpBelow) continue;
    u.phaseIndex++;
    emit(s, { type: 'phase', src: u.id, data: { index: u.phaseIndex } });
  }
}

export function checkOutcome(s: BattleState): void {
  if (s.outcome) return;
  const enemiesLeft = s.units.some((u) => u.team === 'enemy' && u.alive);
  const alliesStanding = s.units.some((u) => u.team === 'ally' && u.alive && !u.downed);
  if (!enemiesLeft) end(s, 'victory');
  else if (!alliesStanding) end(s, 'defeat');
  else if (s.tick >= MAX_TICKS) end(s, 'defeat');
}
