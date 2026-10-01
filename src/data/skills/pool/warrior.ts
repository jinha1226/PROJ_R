import type { SkillDef } from '../../types';
import { t } from '../helpers';

export const WARRIOR_POOL: SkillDef[] = [
  {
    id: 'shield_wall', kind: 'active', cooldown: 14, ...t(0.3, 0.1, 0.4), range: 3, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'self' }, effects: [{ type: 'taunt', duration: 2 }],
    selfEffects: [{ type: 'shield', pctMaxHp: 0.3, duration: 6 }], anim: 'block', aiValue: 26, hints: ['taunt', 'aoe'],
  },
  {
    id: 'cleaving_blow', kind: 'active', cooldown: 9, ...t(0.4, 0.1, 0.5), range: 2, target: 'enemy',
    area: { shape: 'cone', radius: 2, angleDeg: 90 },
    effects: [{ type: 'damage', mult: 1.2 }, { type: 'addTag', tag: 'knockdown', duration: 0.8 }], anim: 'attack1h', aiValue: 25, hints: ['aoe', 'cc'],
  },
  {
    id: 'rally', kind: 'active', cooldown: 12, ...t(0.5, 0.1, 0.4), range: 5, target: 'ally',
    area: { shape: 'circle', radius: 5, center: 'self' }, effects: [{ type: 'heal', mult: 1.5 }], anim: 'cheer', aiValue: 22, hints: ['heal', 'aoe'],
  },
];
