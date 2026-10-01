import type { Rng } from '../../core/rng';
import { ENEMIES } from '../../data/enemies';
import type { EnemyPresetMember } from '../../data/presets';
import type { Role } from '../../data/types';

type Col = 0 | 1 | 2;
const COL: Record<Role, Col> = { vanguard: 2, striker: 2, skirmisher: 2, support: 1, caster: 1, ranged: 0 };
const ROWS = [1, 2, 0, 3] as const;
const BANDITS = ['bandit_cutthroat', 'bandit_cutthroat', 'bandit_archer', 'bandit_hexer'];
const UNDEAD = ['skeleton_minion', 'skeleton_warrior', 'skeleton_archer', 'skeleton_mage', 'skeleton_minion'];

/** Places enemies by role (melee front, casters middle, ranged back), overflowing to the next column. */
function place(ids: string[]): EnemyPresetMember[] {
  const used = new Map<Col, number>([[0, 0], [1, 0], [2, 0]]);
  return ids.map((enemyId) => {
    let col = COL[ENEMIES[enemyId]!.role];
    for (let i = 0; (used.get(col) ?? 0) >= 4 && i < 3; i++) col = ((col + 2) % 3) as Col;
    const n = used.get(col) ?? 0;
    used.set(col, n + 1);
    return { enemyId, col, row: ROWS[n]! };
  });
}

export function enemyGroup(rng: Rng, type: 'battle' | 'elite' | 'boss', stage: number): EnemyPresetMember[] {
  if (type === 'boss') return place(['ashen_knight', 'skeleton_archer', 'skeleton_archer']);
  if (type === 'elite') {
    const n = rng.int(3, 5);
    return place(['bandit_chief', ...Array.from({ length: n }, () => rng.pick(BANDITS))]);
  }
  if (stage <= 1) return place(Array.from({ length: rng.int(2, 3) }, () => 'skeleton_minion'));
  const pool = rng.chance(0.5) ? BANDITS : UNDEAD;
  const n = Math.min(7, 2 + Math.ceil(stage / 2));
  return place(Array.from({ length: n }, () => rng.pick(pool)));
}
