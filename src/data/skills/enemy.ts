import type { SkillDef } from '../types';
import { basic, t } from './helpers';

export const ENEMY_SKILLS: SkillDef[] = [
  {
    id: 'dirty_strike', kind: 'active', cooldown: 8, ...t(0.3, 0.1, 0.4), range: 1.3, target: 'enemy',
    effects: [{ type: 'damage', mult: 1.2 }, { type: 'addTag', tag: 'slow', duration: 2 }],
    anim: 'attack1hStab', aiValue: 22, hints: ['cc'],
  },
  {
    id: 'hex', kind: 'active', cooldown: 9, ...t(0.5, 0.1, 0.4), range: 6, target: 'enemy',
    projectile: { speed: 10, visual: 'dark' },
    effects: [{ type: 'damage', mult: 0.8 }, { type: 'addTag', tag: 'marked', duration: 6 }],
    anim: 'cast', aiValue: 20,
  },
  {
    id: 'ground_slam', kind: 'active', cooldown: 9, ...t(1.2, 0.1, 0.6), range: 3, target: 'enemy',
    area: { shape: 'circle', radius: 2.5, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 1.6 }, { type: 'addTag', tag: 'knockdown', duration: 1 }],
    anim: 'attack2h', aiValue: 30, hints: ['aoe', 'cc'],
  },
  {
    id: 'grave_bolt', kind: 'active', cooldown: 7, ...t(0.5, 0.1, 0.4), range: 6.5, target: 'enemy',
    projectile: { speed: 10, visual: 'dark' },
    effects: [{ type: 'damage', mult: 1.3 }, { type: 'addTag', tag: 'slow', duration: 2 }],
    anim: 'cast', aiValue: 22, hints: ['cc'],
  },
  basic({
    id: 'heavy_cleave', range: 2.2, ...t(0.5, 0.1, 0.6), area: { shape: 'cone', radius: 2.5, angleDeg: 100 },
    effects: [{ type: 'damage', mult: 1.2 }], anim: 'attack2h',
  }),
  {
    id: 'crushing_slam', kind: 'active', cooldown: 8, ...t(1.5, 0.1, 0.7), range: 4, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 2.2 }, { type: 'addTag', tag: 'knockdown', duration: 1.2 }],
    anim: 'leapChop', aiValue: 40, hints: ['aoe', 'cc'],
  },
  {
    id: 'ashen_charge', kind: 'active', cooldown: 11, ...t(1.2, 0.4, 0.6), range: 9, target: 'enemy',
    area: { shape: 'line', length: 9, width: 1.6 }, telegraph: true,
    effects: [{ type: 'damage', mult: 1.6 }, { type: 'knockback', distance: 2 }],
    selfEffects: [{ type: 'dash', distance: 9, stopShort: 0 }],
    anim: 'attack2h', aiValue: 35, hints: ['aoe', 'gapClose'],
  },
  {
    id: 'raise_dead', kind: 'active', cooldown: 20, ...t(1.5, 0.1, 0.5), range: 0, target: 'self',
    effects: [{ type: 'summon', enemyId: 'skeleton_minion', count: 3 }],
    anim: 'castLong', aiValue: 30, hints: ['summon'],
  },
];
