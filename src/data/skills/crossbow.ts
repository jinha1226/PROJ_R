import type { SkillDef } from '../types';
import { basic, t } from './helpers';

export const CROSSBOW_SKILLS: SkillDef[] = [
  basic({
    id: 'bolt_shot', range: 7, projectile: { speed: 18, visual: 'arrow' },
    effects: [{ type: 'damage', mult: 1.0 }], anim: 'shoot2h',
  }),
  {
    id: 'crippling_shot', kind: 'active', cooldown: 6, ...t(0.4, 0.1, 0.4), range: 7, target: 'enemy',
    projectile: { speed: 18, visual: 'arrow' },
    effects: [{ type: 'damage', mult: 1.1 }, { type: 'addTag', tag: 'slow', duration: 3 }],
    anim: 'shoot2h', aiValue: 22, hints: ['cc'],
  },
  {
    id: 'piercing_bolt', kind: 'active', cooldown: 9, ...t(0.7, 0.1, 0.4), range: 8, target: 'enemy',
    area: { shape: 'line', length: 8, width: 1 }, telegraph: true,
    effects: [{ type: 'damage', mult: 1.4 }],
    reacts: [{ tag: 'marked', consume: true, effects: [{ type: 'damage', mult: 1.0 }] }],
    anim: 'shoot2h', aiValue: 26, hints: ['aoe'],
  },
  {
    id: 'volley', kind: 'ultimate', cooldown: 0, ...t(1.0, 0.2, 0.5), range: 8, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 1.5 }, { type: 'addTag', tag: 'slow', duration: 3 }],
    anim: 'shoot2h', aiValue: 60, hints: ['aoe'],
  },
];
