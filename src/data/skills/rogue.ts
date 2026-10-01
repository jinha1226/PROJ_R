import type { SkillDef } from '../types';
import { basic, t } from './helpers';

export const ROGUE_SKILLS: SkillDef[] = [
  basic({ id: 'stab', range: 1.2, effects: [{ type: 'damage', mult: 1.0 }], anim: 'attackDual' }),
  {
    id: 'mark_for_death', kind: 'active', cooldown: 7, ...t(0.25, 0.1, 0.35), range: 1.4, target: 'enemy',
    effects: [{ type: 'damage', mult: 1.2 }, { type: 'addTag', tag: 'marked', duration: 6 }],
    anim: 'attack1hStab', aiValue: 22,
  },
  {
    id: 'shadow_step', kind: 'active', cooldown: 8, ...t(0.2, 0.1, 0.4), range: 6, target: 'enemy',
    effects: [{ type: 'dash', distance: 6, stopShort: 0.8 }, { type: 'damage', mult: 1.5 }],
    reacts: [{ tag: 'marked', consume: true, effects: [{ type: 'damage', mult: 1.5 }] }],
    anim: 'attackDual', aiValue: 24, hints: ['gapClose', 'execute'],
  },
  {
    id: 'assassinate', kind: 'ultimate', cooldown: 0, ...t(0.5, 0.1, 0.5), range: 1.5, target: 'enemy',
    effects: [{ type: 'damage', mult: 3.0 }],
    reacts: [
      { tag: 'knockdown', consume: false, effects: [{ type: 'damage', mult: 1.5 }] },
      { tag: 'marked', consume: true, effects: [{ type: 'damage', mult: 1.5 }] },
    ],
    anim: 'attack1hStab', aiValue: 60, hints: ['execute'],
  },
];
