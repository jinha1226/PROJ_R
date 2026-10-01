import type { SkillDef } from '../types';
import { t } from './helpers';

/** Comrade combo actions. aiValue 0: cast only by the pair-combo system, never picked as normal candidates. */
const combo = (s: Omit<SkillDef, 'kind' | 'cooldown' | 'aiValue'>): SkillDef => ({ ...s, kind: 'active', cooldown: 0, aiValue: 0 });
const FAR = 99;

export const COMBO_SKILLS: SkillDef[] = [
  combo({
    id: 'combo_shield_chant', ...t(0.8, 0.2, 0.5), range: 7, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 2.4 }, { type: 'addTag', tag: 'burn', duration: 4, value: 0.25 }], anim: 'castLong',
  }),
  combo({
    id: 'combo_guard_taunt', ...t(0.3, 0.1, 0.4), range: FAR, target: 'enemy',
    area: { shape: 'circle', radius: 4, center: 'self' },
    effects: [{ type: 'taunt', duration: 3 }], selfEffects: [{ type: 'shield', pctMaxHp: 0.25, duration: 5 }], anim: 'taunt',
  }),
  combo({
    id: 'combo_mark_snipe', ...t(0.7, 0.1, 0.4), range: 9, target: 'enemy', projectile: { speed: 24, visual: 'arrow' },
    effects: [{ type: 'damage', mult: 3.0 }],
    reacts: [{ tag: 'marked', consume: true, effects: [{ type: 'damage', mult: 1.5 }] }], anim: 'shoot2h',
  }),
  combo({
    id: 'combo_mark', ...t(0.2, 0.1, 0.4), range: FAR, target: 'enemy',
    effects: [{ type: 'dash', distance: 6, stopShort: 0.8 }, { type: 'damage', mult: 1.0 }, { type: 'addTag', tag: 'marked', duration: 6 }],
    anim: 'attack1hStab',
  }),
  combo({
    id: 'combo_hammer', ...t(0.6, 0.15, 0.5), range: 7, target: 'enemy',
    effects: [{ type: 'dash', distance: 7, stopShort: 1 }, { type: 'damage', mult: 2.2 }],
    reacts: [{ tag: 'knockdown', consume: false, effects: [{ type: 'damage', mult: 1.5 }] }], anim: 'attack2h',
  }),
  combo({
    id: 'combo_anvil', ...t(0.25, 0.1, 0.5), range: FAR, target: 'enemy',
    effects: [{ type: 'dash', distance: 6, stopShort: 1 }, { type: 'damage', mult: 1.0 }, { type: 'addTag', tag: 'knockdown', duration: 1.5 }],
    anim: 'block',
  }),
  combo({
    id: 'combo_holy_bulwark', ...t(0.6, 0.2, 0.5), range: 5, target: 'ally', area: { shape: 'circle', radius: 5, center: 'self' },
    effects: [{ type: 'shield', pctMaxHp: 0.3, duration: 6 }, { type: 'heal', mult: 2.0 }], anim: 'castLong',
  }),
  combo({
    id: 'combo_purging_storm', ...t(0.6, 0.2, 0.5), range: 7, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 1.6 }, { type: 'addTag', tag: 'wet', duration: 6 }], anim: 'castRaise',
  }),
  combo({
    id: 'combo_judgment', ...t(1.0, 0.1, 0.4), range: FAR, target: 'enemy', effects: [{ type: 'damage', mult: 1.6 }],
    reacts: [{ tag: 'wet', consume: true, effects: [{ type: 'damage', mult: 1.2 }, { type: 'addTag', tag: 'stun', duration: 1.5 }] }],
    anim: 'cast',
  }),
  combo({
    id: 'combo_blood_hunt', ...t(0.4, 0.1, 0.4), range: 6, target: 'enemy',
    effects: [{ type: 'dash', distance: 6, stopShort: 0.8 }, { type: 'damage', mult: 2.5 }, { type: 'addTag', tag: 'bleed', duration: 5, value: 0.25 }],
    anim: 'attackDual',
  }),
  combo({
    id: 'combo_charge', ...t(0.3, 0.15, 0.5), range: FAR, target: 'enemy',
    effects: [{ type: 'dash', distance: 7, stopShort: 1 }, { type: 'damage', mult: 1.4 }, { type: 'knockback', distance: 1 }], anim: 'attack2h',
  }),
  combo({
    id: 'combo_fire_arrows', ...t(0.9, 0.2, 0.5), range: 8, target: 'enemy',
    area: { shape: 'circle', radius: 3, center: 'target' }, telegraph: true,
    effects: [{ type: 'damage', mult: 2.0 }, { type: 'addTag', tag: 'burn', duration: 4, value: 0.25 }], anim: 'shoot2h',
  }),
  combo({ id: 'combo_assist', ...t(0.5, 0.1, 0.4), range: FAR, target: 'self', effects: [], anim: 'castRaise' }),
  combo({
    id: 'combo_zealot', ...t(0.5, 0.15, 0.5), range: 7, target: 'enemy',
    effects: [{ type: 'dash', distance: 7, stopShort: 1 }, { type: 'damage', mult: 2.0 }, { type: 'knockback', distance: 2 }], anim: 'attack2h',
  }),
  combo({
    id: 'combo_zealot_bless', ...t(0.3, 0.1, 0.4), range: FAR, target: 'ally',
    effects: [{ type: 'heal', mult: 3.0 }, { type: 'shield', pctMaxHp: 0.2, duration: 5 }], anim: 'castRaise',
  }),
  combo({ id: 'combo_joint_strike', ...t(0.5, 0.1, 0.5), range: 7, target: 'enemy', effects: [{ type: 'damage', mult: 2.0 }], anim: 'attack1h' }),
  combo({ id: 'combo_joint_follow', ...t(0.7, 0.1, 0.5), range: FAR, target: 'enemy', effects: [{ type: 'damage', mult: 1.2 }], anim: 'attack1h' }),
];
