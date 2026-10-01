import type { AnimKey } from '../../data/types';

export type AnimSet = 'adventurer' | 'skeleton';

const COMMON: Record<AnimKey, string> = {
  idle: 'Idle', run: 'Running_A', walkBack: 'Walking_Backwards',
  attack1h: '1H_Melee_Attack_Chop', attack1hStab: '1H_Melee_Attack_Stab', attack2h: '2H_Melee_Attack_Chop',
  attack2hSpin: '2H_Melee_Attack_Spin', attackDual: 'Dualwield_Melee_Attack_Slice',
  shoot1h: '1H_Ranged_Shoot', shoot2h: '2H_Ranged_Shoot',
  cast: 'Spellcast_Shoot', castRaise: 'Spellcast_Raise', castLong: 'Spellcast_Long',
  block: 'Block', hit: 'Hit_A', dodgeL: 'Dodge_Left', dodgeR: 'Dodge_Right', dodgeB: 'Dodge_Backward',
  death: 'Death_A', downed: 'Lie_Idle', standUp: 'Lie_StandUp', cheer: 'Cheer', throw: 'Throw',
  spawn: 'Cheer', taunt: 'Cheer', leapChop: '2H_Melee_Attack_Chop',
};

export const ANIM_CLIPS: Record<AnimSet, Record<AnimKey, string>> = {
  adventurer: COMMON,
  skeleton: {
    ...COMMON,
    idle: 'Idle_Combat', spawn: 'Spawn_Ground_Skeletons', taunt: 'Taunt', leapChop: '1H_Melee_Attack_Jump_Chop',
  },
};

export const LOOPING: ReadonlySet<AnimKey> = new Set<AnimKey>(['idle', 'run', 'walkBack', 'downed']);
