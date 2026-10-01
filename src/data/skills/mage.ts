import type { SkillDef } from '../types';
import { basic, t } from './helpers';

export const MAGE_SKILLS: SkillDef[] = [
  basic({
    id: 'arcane_bolt', range: 6.5, projectile: { speed: 12, visual: 'bolt' },
    effects: [{ type: 'damage', mult: 1.0 }], anim: 'cast',
  }),
  {
    id: 'water_splash', kind: 'active', cooldown: 8, ...t(0.8, 0.1, 0.4), range: 6.5, target: 'enemy',
    area: { shape: 'circle', radius: 2.5, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 0.6 }, { type: 'addTag', tag: 'wet', duration: 6 }],
    anim: 'castRaise', aiValue: 24, hints: ['aoe'],
  },
  {
    id: 'fireball', kind: 'active', cooldown: 9, ...t(0.6, 0.1, 0.5), range: 6.5, target: 'enemy',
    projectile: { speed: 10, visual: 'fireball' }, area: { shape: 'circle', radius: 1.8, center: 'target' },
    effects: [{ type: 'damage', mult: 1.4 }, { type: 'addTag', tag: 'burn', duration: 4, value: 0.2 }],
    reacts: [{ tag: 'wet', consume: true, effects: [{ type: 'damage', mult: 0.5 }] }],
    anim: 'cast', aiValue: 26, hints: ['aoe'],
  },
  {
    id: 'thunderstorm', kind: 'ultimate', cooldown: 0, ...t(1.2, 0.2, 0.6), range: 7, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 1.4 }],
    reacts: [{ tag: 'wet', consume: true, effects: [{ type: 'damage', mult: 1.0 }, { type: 'addTag', tag: 'stun', duration: 1.5 }] }],
    anim: 'castLong', aiValue: 60, hints: ['aoe', 'cc'],
  },
];
