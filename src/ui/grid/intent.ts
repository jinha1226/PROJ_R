import { archerCanShoot } from '../../sim/grid/ai';
import type { Ent, GridState } from '../../sim/grid/types';

/** Mirrors the simulation's telegraphs and archer shooting eligibility. */
export function intentOf(s: GridState, foe: Ent): string {
  if (!foe.alive) return '';
  const pending = s.telegraphs.filter((t) => t.src === foe.id);
  if (pending.some((t) => t.kind === 'whirl')) return '회전 베기 준비';
  if (pending.some((t) => t.kind === 'spell')) return '주문 준비';
  if (foe.kind === 'archer' && archerCanShoot(s, foe)) return '조준 중';
  return foe.awake ? '' : '잠듦';
}
