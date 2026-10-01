import { emit } from './events';
import type { BattleState, UnitState } from './types';

export interface HitOpts {
  mult: number;
  canDodge: boolean;
  canCrit: boolean;
  skillId: string;
  reason?: string;
}

export function dealDamage(s: BattleState, src: UnitState, dst: UnitState, opts: HitOpts): number {
  const amount = Math.max(1, Math.round(src.setup.stats.atk * opts.mult));
  dst.hp = Math.max(0, dst.hp - amount);
  emit(s, { type: 'damage', src: src.id, dst: dst.id, amount, skillId: opts.skillId });
  return amount;
}
