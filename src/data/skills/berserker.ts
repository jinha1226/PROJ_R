import type { SkillDef } from '../types';
import { basic, t } from './helpers';

export const BERSERKER_SKILLS: SkillDef[] = [
  basic({
    id: 'cleave', range: 1.5, area: { shape: 'cone', radius: 1.8, angleDeg: 90 },
    effects: [{ type: 'damage', mult: 1.0 }], anim: 'attack2h',
  }),
  {
    id: 'charge', kind: 'active', cooldown: 9, ...t(0.35, 0.15, 0.5), range: 7, target: 'enemy',
    effects: [{ type: 'dash', distance: 7, stopShort: 1 }, { type: 'damage', mult: 1.3 }, { type: 'knockback', distance: 1.5 }],
    reacts: [{ tag: 'slow', consume: false, effects: [{ type: 'damage', mult: 1.0 }] }],
    anim: 'attack2h', aiValue: 26, hints: ['gapClose'],
  },
  {
    id: 'whirlwind', kind: 'active', cooldown: 10, ...t(0.3, 0.4, 0.5), range: 2.5, target: 'enemy',
    area: { shape: 'circle', radius: 2.5, center: 'self' },
    effects: [{ type: 'damage', mult: 0.9 }, { type: 'addTag', tag: 'bleed', duration: 4, value: 0.15 }],
    reacts: [{ tag: 'knockdown', consume: true, effects: [{ type: 'damage', mult: 1.5 }] }],
    anim: 'attack2hSpin', aiValue: 24, hints: ['aoe'],
  },
  {
    id: 'bloodrage', kind: 'ultimate', cooldown: 0, ...t(0.4, 0.5, 0.6), range: 3, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'self' },
    effects: [{ type: 'damage', mult: 1.8 }, { type: 'addTag', tag: 'bleed', duration: 5, value: 0.2 }],
    anim: 'attack2hSpin', aiValue: 60, hints: ['aoe'],
  },
];
