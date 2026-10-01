import type { SkillDef } from '../types';
import { basic, t } from './helpers';

export const WARRIOR_SKILLS: SkillDef[] = [
  basic({ id: 'warrior_strike', range: 1.3, effects: [{ type: 'damage', mult: 1.0 }], anim: 'attack1h' }),
  {
    id: 'shield_bash', kind: 'active', cooldown: 8, ...t(0.3, 0.1, 0.5), range: 1.5, target: 'enemy',
    effects: [{ type: 'damage', mult: 1.0 }, { type: 'addTag', tag: 'knockdown', duration: 1 }],
    anim: 'block', aiValue: 25, hints: ['cc'],
  },
  {
    id: 'taunt_shout', kind: 'active', cooldown: 12, ...t(0.4, 0.1, 0.4), range: 4, target: 'enemy',
    area: { shape: 'circle', radius: 4, center: 'self' },
    effects: [{ type: 'taunt', duration: 3 }],
    selfEffects: [{ type: 'shield', pctMaxHp: 0.15, duration: 4 }],
    anim: 'taunt', aiValue: 28, hints: ['taunt', 'aoe'],
  },
  {
    id: 'bulwark', kind: 'ultimate', cooldown: 0, ...t(0.5, 0.1, 0.5), range: 5, target: 'ally',
    area: { shape: 'circle', radius: 5, center: 'self' },
    effects: [{ type: 'shield', pctMaxHp: 0.2, duration: 6 }],
    anim: 'castRaise', aiValue: 60, hints: ['shield', 'aoe'],
  },
];
