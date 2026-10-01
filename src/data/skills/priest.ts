import type { SkillDef } from '../types';
import { basic, t } from './helpers';

export const PRIEST_SKILLS: SkillDef[] = [
  basic({
    id: 'smite', range: 6, projectile: { speed: 12, visual: 'holy' },
    effects: [{ type: 'damage', mult: 0.8 }], anim: 'cast',
  }),
  {
    id: 'heal', kind: 'active', cooldown: 4, ...t(0.5, 0.1, 0.4), range: 6, target: 'ally',
    effects: [{ type: 'heal', mult: 3.5 }], anim: 'castRaise', aiValue: 20, hints: ['heal'],
  },
  {
    id: 'judgment', kind: 'active', cooldown: 10, ...t(0.6, 0.1, 0.5), range: 6.5, target: 'enemy',
    effects: [{ type: 'damage', mult: 1.6 }],
    reacts: [{ tag: 'wet', consume: true, effects: [{ type: 'damage', mult: 1.2 }, { type: 'addTag', tag: 'stun', duration: 1 }] }],
    anim: 'cast', aiValue: 26, hints: ['cc'],
  },
  {
    id: 'sanctuary', kind: 'ultimate', cooldown: 0, ...t(0.8, 0.2, 0.6), range: 6, target: 'ally',
    area: { shape: 'circle', radius: 6, center: 'self' },
    effects: [{ type: 'heal', mult: 3.0 }, { type: 'cleanse' }],
    anim: 'castLong', aiValue: 60, hints: ['heal', 'aoe'],
  },
];
