import type { SkillDef } from '../../types';
import { t } from '../helpers';

export const BERSERKER_POOL: SkillDef[] = [
  {
    id: 'leap_slam', kind: 'active', cooldown: 10, ...t(0.45, 0.15, 0.5), range: 6, target: 'enemy',
    area: { shape: 'circle', radius: 2, center: 'target' },
    effects: [{ type: 'damage', mult: 1.5 }, { type: 'addTag', tag: 'knockdown', duration: 1 }],
    selfEffects: [{ type: 'dash', distance: 6, stopShort: 0 }], anim: 'leapChop', aiValue: 27, hints: ['aoe', 'cc', 'gapClose'],
  },
  {
    id: 'rending_strike', kind: 'active', cooldown: 8, ...t(0.35, 0.1, 0.45), range: 1.6, target: 'enemy',
    effects: [{ type: 'damage', mult: 1.6 }, { type: 'addTag', tag: 'bleed', duration: 6, value: 0.25 }], anim: 'attack2h', aiValue: 24,
  },
  {
    id: 'frenzy', kind: 'active', cooldown: 11, ...t(0.3, 0.3, 0.5), range: 2.5, target: 'enemy',
    area: { shape: 'circle', radius: 2.5, center: 'self' }, effects: [{ type: 'damage', mult: 1.1 }],
    selfEffects: [{ type: 'shield', pctMaxHp: 0.15, duration: 4 }], anim: 'attack2hSpin', aiValue: 24, hints: ['aoe'],
  },
];
