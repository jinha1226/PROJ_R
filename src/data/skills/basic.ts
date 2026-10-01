import type { SkillDef } from '../types';
import { basic, t } from './helpers';

export const NOVICE_SKILLS: SkillDef[] = [
  basic({ id: 'novice_slash', range: 1.3, effects: [{ type: 'damage', mult: 1.0 }], anim: 'attack1h' }),
  {
    id: 'novice_lunge', kind: 'active', cooldown: 7, ...t(0.3, 0.1, 0.4), range: 5, target: 'enemy',
    effects: [{ type: 'dash', distance: 5, stopShort: 1 }, { type: 'damage', mult: 1.2 }],
    anim: 'attack1hStab', aiValue: 22, hints: ['gapClose'],
  },
  {
    id: 'novice_desperate', kind: 'ultimate', cooldown: 0, ...t(0.4, 0.1, 0.5), range: 1.5, target: 'enemy',
    effects: [{ type: 'damage', mult: 1.8 }, { type: 'knockback', distance: 2 }],
    anim: 'attack1h', aiValue: 60,
  },
];
