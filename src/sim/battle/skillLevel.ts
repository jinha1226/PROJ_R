import type { UnitSetup } from './types';

/** Skill level 1–3 from progression; damage/heal ×(1+0.2(L−1)), cooldown ×(1−0.1(L−1)). */
export const skillLevel = (u: UnitSetup, skillId: string): number => Math.min(3, Math.max(1, u.skillLevels?.[skillId] ?? 1));
export const skillPowerMult = (u: UnitSetup, skillId: string): number => 1 + 0.2 * (skillLevel(u, skillId) - 1);
export const skillCooldownMult = (u: UnitSetup, skillId: string): number => 1 - 0.1 * (skillLevel(u, skillId) - 1);
