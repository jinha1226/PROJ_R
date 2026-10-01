import type { SkillDef } from '../types';
import { NOVICE_SKILLS } from './basic';
import { WARRIOR_SKILLS } from './warrior';
import { BERSERKER_SKILLS } from './berserker';
import { ROGUE_SKILLS } from './rogue';
import { CROSSBOW_SKILLS } from './crossbow';
import { MAGE_SKILLS } from './mage';
import { PRIEST_SKILLS } from './priest';
import { ENEMY_SKILLS } from './enemy';
import { COMBO_SKILLS } from './combo';
import { WARRIOR_POOL } from './pool/warrior';
import { BERSERKER_POOL } from './pool/berserker';
import { ROGUE_POOL } from './pool/rogue';
import { CROSSBOW_POOL } from './pool/crossbow';
import { MAGE_POOL } from './pool/mage';
import { PRIEST_POOL } from './pool/priest';

const ALL: SkillDef[] = [
  ...NOVICE_SKILLS, ...WARRIOR_SKILLS, ...BERSERKER_SKILLS, ...ROGUE_SKILLS,
  ...CROSSBOW_SKILLS, ...MAGE_SKILLS, ...PRIEST_SKILLS, ...ENEMY_SKILLS, ...COMBO_SKILLS,
  ...WARRIOR_POOL, ...BERSERKER_POOL, ...ROGUE_POOL, ...CROSSBOW_POOL, ...MAGE_POOL, ...PRIEST_POOL,
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(ALL.map((s) => [s.id, s]));

export function getSkill(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error(`unknown skill: ${id}`);
  return s;
}
