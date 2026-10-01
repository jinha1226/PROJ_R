import type { SkillDef } from '../../types';
import { t } from '../helpers';

export const MAGE_POOL: SkillDef[] = [
  {
    id: 'frost_lance', kind: 'active', cooldown: 8, ...t(0.5, 0.1, 0.45), range: 6.5, target: 'enemy',
    projectile: { speed: 14, visual: 'bolt' },
    effects: [{ type: 'damage', mult: 1.5 }, { type: 'addTag', tag: 'slow', duration: 3 }],
    reacts: [{ tag: 'wet', consume: true, effects: [{ type: 'addTag', tag: 'stun', duration: 1 }] }], anim: 'cast', aiValue: 24, hints: ['cc'],
  },
  {
    id: 'chain_spark', kind: 'active', cooldown: 7, ...t(0.45, 0.1, 0.4), range: 6.5, target: 'enemy',
    effects: [{ type: 'damage', mult: 1.3 }],
    reacts: [{ tag: 'wet', consume: false, effects: [{ type: 'damage', mult: 1.0 }] }], anim: 'cast', aiValue: 23,
  },
  {
    id: 'meteor', kind: 'active', cooldown: 16, ...t(1.4, 0.2, 0.6), range: 7, target: 'enemy',
    area: { shape: 'circle', radius: 2.5, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 2.6 }, { type: 'addTag', tag: 'burn', duration: 4, value: 0.2 }], anim: 'castLong', aiValue: 30, hints: ['aoe'],
  },
];
