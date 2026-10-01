import type { SkillDef } from '../../types';
import { t } from '../helpers';

export const ROGUE_POOL: SkillDef[] = [
  {
    id: 'smoke_bomb', kind: 'active', cooldown: 12, ...t(0.25, 0.1, 0.35), range: 3, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'self' }, effects: [{ type: 'addTag', tag: 'slow', duration: 3 }],
    anim: 'throw', aiValue: 22, hints: ['aoe', 'cc'],
  },
  {
    id: 'poison_blade', kind: 'active', cooldown: 7, ...t(0.25, 0.1, 0.35), range: 1.3, target: 'enemy',
    effects: [{ type: 'damage', mult: 1.0 }, { type: 'addTag', tag: 'bleed', duration: 6, value: 0.3 }], anim: 'attack1hStab', aiValue: 23,
  },
  {
    id: 'fan_of_knives', kind: 'active', cooldown: 10, ...t(0.3, 0.1, 0.4), range: 3, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'self' },
    effects: [{ type: 'damage', mult: 0.9 }, { type: 'addTag', tag: 'marked', duration: 4 }], anim: 'throw', aiValue: 24, hints: ['aoe'],
  },
];
