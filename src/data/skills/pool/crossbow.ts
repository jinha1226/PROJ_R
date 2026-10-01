import type { SkillDef } from '../../types';
import { t } from '../helpers';

export const CROSSBOW_POOL: SkillDef[] = [
  {
    id: 'explosive_bolt', kind: 'active', cooldown: 10, ...t(0.5, 0.1, 0.45), range: 7, target: 'enemy',
    projectile: { speed: 16, visual: 'fireball' }, area: { shape: 'circle', radius: 2, center: 'target' },
    effects: [{ type: 'damage', mult: 1.3 }, { type: 'addTag', tag: 'knockdown', duration: 0.8 }], anim: 'shoot2h', aiValue: 26, hints: ['aoe', 'cc'],
  },
  {
    id: 'pinning_shot', kind: 'active', cooldown: 11, ...t(0.5, 0.1, 0.4), range: 7, target: 'enemy',
    projectile: { speed: 20, visual: 'arrow' },
    effects: [{ type: 'damage', mult: 1.2 }, { type: 'addTag', tag: 'stun', duration: 1 }], anim: 'shoot2h', aiValue: 24, hints: ['cc'],
  },
  {
    id: 'rain_of_bolts', kind: 'active', cooldown: 12, ...t(0.9, 0.2, 0.5), range: 8, target: 'enemy',
    area: { shape: 'circle', radius: 3.5, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 1.2 }, { type: 'addTag', tag: 'slow', duration: 3 }], anim: 'shoot2h', aiValue: 26, hints: ['aoe'],
  },
];
