import { enemyFromDef } from '../battle/setup';
import type { UnitSetup } from '../battle/types';

/**
 * Region enemies were tuned against parties; a lone hero meets them one group at a time.
 * Health and attack are scaled for solo sorties (tuned with the sortie bot, see docs/balance.md).
 */
export const SOLO_HP = 0.45;
export const SOLO_ATK = 0.45;

/** storm hunters are elites: scaled down far less */
export const HUNTER_SCALE = 0.9;

export function worldEnemy(enemyId: string, stage: number, index: number, hunter = false): UnitSetup {
  const s = enemyFromDef(enemyId, 2, 0, stage, index);
  const hp = hunter ? HUNTER_SCALE : SOLO_HP;
  const atk = hunter ? HUNTER_SCALE : SOLO_ATK;
  return { ...s, stats: { ...s.stats, maxHp: Math.round(s.stats.maxHp * hp), atk: Math.round(s.stats.atk * atk * 10) / 10 } };
}
