import type { ClassId, ItemDef, WeaponType } from './types';

export const WEAPON_TYPE_OF_CLASS: Record<ClassId, WeaponType> = {
  novice: 'sword_shield', warrior: 'sword_shield', berserker: 'axe2h', rogue: 'daggers',
  crossbow: 'crossbow', mage: 'staff', priest: 'wand',
};

const W = (id: string, tier: ItemDef['tier'], weaponType: WeaponType, atk: number, visual: ItemDef['visual'], unique?: ItemDef['unique']): ItemDef =>
  ({ id, slot: 'weapon', tier, weaponType, stats: { atk }, visual, unique });
const A = (id: string, tier: ItemDef['tier'], stats: ItemDef['stats'], helmet: boolean, cape: boolean, unique?: ItemDef['unique']): ItemDef =>
  ({ id, slot: 'armor', tier, stats, visual: { helmet, cape }, unique });
const T = (id: string, tier: ItemDef['tier'], stats: ItemDef['stats'], unique?: ItemDef['unique']): ItemDef =>
  ({ id, slot: 'trinket', tier, stats, unique });

const list: ItemDef[] = [
  W('worn_sword', 0, 'sword_shield', 0, { weapon: '1H_Sword' }),
  W('knight_blade', 3, 'sword_shield', 10, { weapon: '1H_Sword', offhand: 'Badge_Shield' }, 'friendGuard'),
  W('worn_axe', 0, 'axe2h', 0, { weapon: '2H_Axe' }),
  W('bloodaxe', 2, 'axe2h', 6, { weapon: '2H_Axe' }, 'knockdownBleed'),
  W('worn_daggers', 0, 'daggers', 0, { weapon: 'Knife', offhand: 'Knife_Offhand' }),
  W('shadow_fangs', 3, 'daggers', 10, { weapon: 'Knife', offhand: 'Knife_Offhand' }, 'markReset'),
  W('worn_crossbow', 0, 'crossbow', 0, { weapon: '1H_Crossbow' }),
  W('hunter_crossbow', 2, 'crossbow', 6, { weapon: '2H_Crossbow' }, 'lastStand'),
  W('worn_staff', 0, 'staff', 0, { weapon: 'Staff' }),
  W('storm_staff', 4, 'staff', 15, { weapon: 'Staff' }, 'wetLightning'),
  W('worn_wand', 0, 'wand', 0, { weapon: 'Wand' }),
  W('saint_wand', 2, 'wand', 6, { weapon: 'Wand', offhand: 'Spellbook' }, 'friendGuard'),
  A('ragged_clothes', 0, {}, false, false),
  A('padded_vest', 1, { def: 4, maxHp: 10 }, false, false),
  A('leather_armor', 1, { def: 4, maxHp: 10 }, true, false),
  A('traveler_cloak', 1, { def: 3, maxHp: 10, dodge: 0.02 }, false, true),
  A('chain_mail', 2, { def: 8, maxHp: 25 }, true, false),
  A('scale_armor', 2, { def: 8, maxHp: 25 }, true, false),
  A('ranger_coat', 2, { def: 6, maxHp: 20, moveSpeed: 0.2 }, false, true),
  A('sage_robe', 2, { def: 5, maxHp: 20, atk: 2 }, true, true),
  A('guard_plate', 3, { def: 13, maxHp: 40 }, true, true, 'thorns'),
  A('dragon_plate', 4, { def: 20, maxHp: 60 }, true, true, 'lastStand'),
  T('lucky_coin', 1, { crit: 0.05 }),
  T('iron_ring', 1, { def: 3 }),
  T('swift_boots', 1, { moveSpeed: 0.3 }),
  T('healer_charm', 1, { maxHp: 20 }),
  T('rune_stone', 2, { atk: 3 }),
  T('war_horn', 2, {}, 'firstStrike'),
  T('vampire_fang', 3, { atk: 2 }, 'lifesteal'),
  T('storm_amulet', 3, { atk: 2 }, 'wetLightning'),
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef {
  const i = ITEMS[id];
  if (!i) throw new Error(`unknown item: ${id}`);
  return i;
}

/** The worn starting weapon for a class. */
export const starterWeapon = (c: ClassId): string =>
  list.find((i) => i.slot === 'weapon' && i.tier === 0 && i.weaponType === WEAPON_TYPE_OF_CLASS[c])!.id;
