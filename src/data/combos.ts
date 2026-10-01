import type { ClassId, ComboDef } from './types';

const c = (id: string, a: ClassId, b: ClassId, lead: ClassId, skill: string, partnerSkill: string): ComboDef =>
  ({ id, classes: [a, b], lead, skill, partnerSkill, cooldown: 25 });

/** Comrade pair combos, keyed by class pair. */
export const COMBOS: ComboDef[] = [
  c('shield_chant', 'warrior', 'mage', 'mage', 'combo_shield_chant', 'combo_guard_taunt'),
  c('mark_snipe', 'rogue', 'crossbow', 'crossbow', 'combo_mark_snipe', 'combo_mark'),
  c('hammer_anvil', 'berserker', 'warrior', 'berserker', 'combo_hammer', 'combo_anvil'),
  c('holy_bulwark', 'priest', 'warrior', 'priest', 'combo_holy_bulwark', 'combo_guard_taunt'),
  c('purging_storm', 'mage', 'priest', 'mage', 'combo_purging_storm', 'combo_judgment'),
  c('blood_hunt', 'rogue', 'berserker', 'rogue', 'combo_blood_hunt', 'combo_charge'),
  c('fire_arrows', 'crossbow', 'mage', 'crossbow', 'combo_fire_arrows', 'combo_assist'),
  c('zealot_charge', 'berserker', 'priest', 'berserker', 'combo_zealot', 'combo_zealot_bless'),
];

export const GENERIC_COMBO: ComboDef = {
  id: 'joint_strike', classes: ['novice', 'novice'], lead: 'novice', skill: 'combo_joint_strike', partnerSkill: 'combo_joint_follow', cooldown: 25,
};
