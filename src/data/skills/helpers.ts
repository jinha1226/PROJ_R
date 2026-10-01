import type { SkillDef } from '../types';

export const MELEE = { windup: 0.35, active: 0.1, recovery: 0.45 } as const;
export const RANGED = { windup: 0.45, active: 0.1, recovery: 0.55 } as const;

type BasicInput = Omit<SkillDef, 'kind' | 'cooldown' | 'aiValue' | 'windup' | 'active' | 'recovery' | 'target'> &
  Partial<Pick<SkillDef, 'windup' | 'active' | 'recovery'>>;

/** Basic attacks: no cooldown, aiValue 10, enemy target, melee or ranged timing by range. */
export const basic = (s: BasicInput): SkillDef => ({
  ...(s.range > 2 ? RANGED : MELEE),
  ...s,
  kind: 'basic',
  cooldown: 0,
  target: 'enemy',
  aiValue: 10,
});

export const t = (windup: number, active: number, recovery: number) => ({ windup, active, recovery });
