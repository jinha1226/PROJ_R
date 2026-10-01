import { ENEMY_PRESETS, type EnemyPresetMember } from '../../data/presets';
import type { BattleSetup } from '../battle/types';
import { enemyFromDef, setupFromPresets } from '../battle/setup';
import { autoFormation } from './formation';
import { mercToUnitSetup } from './toSetup';
import type { Roster } from './types';

const MAX_STAGE = 12;
const MAX_DEPLOY = 5;

export const stageFor = (battles: number): number => Math.min(MAX_STAGE, 1 + Math.floor(battles / 2));

/** Default deployment: living mercs, uninjured first, up to five. */
export function deployable(r: Roster): string[] {
  return [...r.mercs].filter((m) => m.alive).sort((a, b) => Number(a.injury > 0) - Number(b.injury > 0)).slice(0, MAX_DEPLOY).map((m) => m.id);
}

export function companyBattleSetup(
  r: Roster, deployed: string[], enemy: string | EnemyPresetMember[], stage: number, seed: number,
  formation?: Record<string, { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 }>,
): BattleSetup {
  const preset = typeof enemy === 'string' ? ENEMY_PRESETS[enemy] : { stage, members: enemy };
  if (!preset) throw new Error(`unknown enemy preset: ${String(enemy)}`);
  const mercs = deployed.map((id) => r.mercs.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m && m.alive);
  const placed = formation && mercs.every((m) => formation[m.id])
    ? mercs.map((merc) => ({ merc, ...formation[merc.id]! }))
    : autoFormation(mercs);
  const allies = placed.map(({ merc, col, row }, i) => mercToUnitSetup(merc, i, { col, row }));
  const enemyStage = Math.max(stage, preset.stage);
  const enemies = preset.members.map((m, i) => enemyFromDef(m.enemyId, m.col, m.row, enemyStage, i));
  const ids = new Set(allies.map((a) => a.id));
  return {
    seed, allies, enemies,
    obstacles: setupFromPresets(seed, 'solo', 'empty').obstacles,
    relations: r.relations.filter((x) => ids.has(x.a) && ids.has(x.b)).map((x) => ({ ...x })),
  };
}
