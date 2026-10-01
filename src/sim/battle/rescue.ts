import { dist } from '../../core/vec2';
import { RESCUE_HP, RESCUE_RANGE, RESCUE_TICKS } from './constants';
import { emit } from './events';
import type { BattleState } from './types';

export function updateRescue(s: BattleState): void {
  for (const u of s.units) {
    if (!u.rescueTarget) continue;
    const t = s.units.find((o) => o.id === u.rescueTarget);
    if (!u.alive || u.downed || !t || !t.alive || !t.downed || t.rescueUsed) {
      u.rescueTarget = null;
      u.rescueProgress = 0;
      continue;
    }
    if (u.action || dist(u.pos, t.pos) > RESCUE_RANGE + 0.1) {
      u.rescueProgress = 0;
      continue;
    }
    u.rescueProgress++;
    if (u.rescueProgress % 10 === 0 && u.rescueProgress < RESCUE_TICKS)
      emit(s, { type: 'rescue_progress', src: u.id, dst: t.id, data: { progress: u.rescueProgress / RESCUE_TICKS } });
    if (u.rescueProgress < RESCUE_TICKS) continue;
    t.downed = false;
    t.hp = Math.round(t.maxHp * RESCUE_HP);
    t.lifeline = 0;
    t.rescueUsed = true;
    t.decisionIn = 0;
    u.rescueTarget = null;
    u.rescueProgress = 0;
    u.decisionIn = 0;
    emit(s, { type: 'rescued', src: u.id, dst: t.id });
  }
}
