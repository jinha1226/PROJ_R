import type { ClassDef, ClassId, Stats } from './types';

const stats = (
  maxHp: number, atk: number, def: number, atkSpeed: number,
  range: number, moveSpeed: number, dodge: number, crit: number,
): Stats => ({ maxHp, atk, def, atkSpeed, range, moveSpeed, dodge, crit });

/** Per-level growth: +10% hp, +8% atk, +5% def of the base value (rounded). */
const growthOf = (b: Stats): Partial<Stats> => ({
  maxHp: Math.round(b.maxHp * 0.1),
  atk: Math.round(b.atk * 0.08),
  def: Math.round(b.def * 0.05),
});

const POOLS: Record<ClassId, string[]> = {
  novice: [],
  warrior: ['shield_wall', 'cleaving_blow', 'rally'],
  berserker: ['leap_slam', 'rending_strike', 'frenzy'],
  rogue: ['smoke_bomb', 'poison_blade', 'fan_of_knives'],
  crossbow: ['explosive_bolt', 'pinning_shot', 'rain_of_bolts'],
  mage: ['frost_lance', 'chain_spark', 'meteor'],
  priest: ['holy_shield', 'mass_heal', 'blessed_strike'],
};

/** pool = starting actives + learnable class actives (5 total for combat classes). */
const def = (c: Omit<ClassDef, 'growth' | 'pool'>): ClassDef => ({ ...c, growth: growthOf(c.base), pool: c.id === 'novice' ? [] : [...c.actives, ...POOLS[c.id]] });

export const CLASSES: Record<ClassId, ClassDef> = {
  novice: def({
    id: 'novice', role: 'striker', base: stats(120, 14, 8, 1.0, 1.3, 3.2, 0.05, 0.05),
    basic: 'novice_slash', actives: ['novice_lunge'], ultimate: 'novice_desperate',
    model: 'Knight', gear: { weapon: '1H_Sword', helmet: false, cape: false },
  }),
  warrior: def({
    id: 'warrior', role: 'vanguard', base: stats(180, 13, 25, 0.9, 1.3, 3.0, 0.03, 0.05),
    basic: 'warrior_strike', actives: ['shield_bash', 'taunt_shout'], ultimate: 'bulwark',
    model: 'Knight', gear: { weapon: '1H_Sword', offhand: 'Round_Shield', helmet: true, cape: false },
  }),
  berserker: def({
    id: 'berserker', role: 'striker', base: stats(150, 20, 10, 0.95, 1.5, 3.4, 0.03, 0.1),
    basic: 'cleave', actives: ['charge', 'whirlwind'], ultimate: 'bloodrage',
    model: 'Barbarian', gear: { weapon: '2H_Axe', helmet: false, cape: false },
  }),
  rogue: def({
    id: 'rogue', role: 'skirmisher', base: stats(110, 17, 8, 1.3, 1.2, 4.0, 0.2, 0.15),
    basic: 'stab', actives: ['mark_for_death', 'shadow_step'], ultimate: 'assassinate',
    model: 'Rogue', gear: { weapon: 'Knife', offhand: 'Knife_Offhand', helmet: false, cape: false },
  }),
  crossbow: def({
    id: 'crossbow', role: 'ranged', base: stats(100, 16, 6, 0.9, 7.0, 3.2, 0.08, 0.1),
    basic: 'bolt_shot', actives: ['crippling_shot', 'piercing_bolt'], ultimate: 'volley',
    model: 'Rogue_Hooded', gear: { weapon: '2H_Crossbow', helmet: true, cape: false },
  }),
  mage: def({
    id: 'mage', role: 'caster', base: stats(90, 18, 5, 0.8, 6.5, 3.0, 0.05, 0.05),
    basic: 'arcane_bolt', actives: ['water_splash', 'fireball'], ultimate: 'thunderstorm',
    model: 'Mage', gear: { weapon: 'Staff', helmet: true, cape: false },
  }),
  priest: def({
    id: 'priest', role: 'support', base: stats(100, 9, 8, 0.9, 6.0, 3.0, 0.05, 0.05),
    basic: 'smite', actives: ['heal', 'judgment'], ultimate: 'sanctuary',
    model: 'Mage', gear: { weapon: 'Wand', offhand: 'Spellbook', helmet: false, cape: false },
  }),
};
