import type { SkillDef } from '../../types';
import { t } from '../helpers';

export const PRIEST_POOL: SkillDef[] = [
  {
    id: 'holy_shield', kind: 'active', cooldown: 8, ...t(0.4, 0.1, 0.4), range: 6, target: 'ally',
    effects: [{ type: 'shield', pctMaxHp: 0.25, duration: 6 }], anim: 'castRaise', aiValue: 22, hints: ['shield'],
  },
  {
    id: 'mass_heal', kind: 'active', cooldown: 12, ...t(0.7, 0.2, 0.5), range: 5, target: 'ally',
    area: { shape: 'circle', radius: 5, center: 'self' }, effects: [{ type: 'heal', mult: 2.0 }], anim: 'castLong', aiValue: 24, hints: ['heal', 'aoe'],
  },
  {
    id: 'blessed_strike', kind: 'active', cooldown: 8, ...t(0.4, 0.1, 0.4), range: 6, target: 'enemy',
    effects: [{ type: 'damage', mult: 1.2 }], selfEffects: [{ type: 'heal', mult: 1.0 }],
    reacts: [{ tag: 'marked', consume: false, effects: [{ type: 'damage', mult: 1.0 }] }], anim: 'cast', aiValue: 22,
  },
];
