import type { EnemyDef, Stats } from './types';

const stats = (
  maxHp: number, atk: number, def: number, atkSpeed: number,
  range: number, moveSpeed: number, dodge: number, crit: number,
): Stats => ({ maxHp, atk, def, atkSpeed, range, moveSpeed, dodge, crit });

const list: EnemyDef[] = [
  {
    id: 'bandit_cutthroat', role: 'skirmisher', base: stats(90, 11, 6, 1.1, 1.2, 3.6, 0.1, 0.1),
    basic: 'stab', actives: ['dirty_strike'], model: 'Rogue',
    gear: { weapon: 'Knife', helmet: false, cape: false }, tint: '#8a6a4a',
  },
  {
    id: 'bandit_archer', role: 'ranged', base: stats(70, 10, 4, 0.85, 6.5, 3.2, 0.05, 0.05),
    basic: 'bolt_shot', actives: ['crippling_shot'], model: 'Rogue_Hooded',
    gear: { weapon: '1H_Crossbow', helmet: true, cape: false }, tint: '#7a5a3a',
  },
  {
    id: 'bandit_hexer', role: 'caster', base: stats(70, 12, 4, 0.8, 6, 3.0, 0.05, 0.05),
    basic: 'arcane_bolt', actives: ['hex'], model: 'Mage',
    gear: { weapon: 'Wand', helmet: true, cape: false }, tint: '#6a4a6a',
  },
  {
    id: 'bandit_chief', role: 'striker', base: stats(320, 18, 15, 0.9, 1.5, 3.2, 0.05, 0.1),
    basic: 'cleave', actives: ['ground_slam', 'charge'], model: 'Barbarian',
    gear: { weapon: '2H_Axe', helmet: true, cape: false }, tint: '#a05a3a', scale: 1.15, elite: true,
  },
  {
    id: 'skeleton_minion', role: 'striker', base: stats(50, 8, 4, 1.0, 1.2, 3.0, 0, 0.05),
    basic: 'warrior_strike', actives: [], model: 'Skeleton_Minion',
    gear: { weapon: 'Blade', helmet: false, cape: false },
  },
  {
    id: 'skeleton_warrior', role: 'vanguard', base: stats(120, 12, 18, 0.9, 1.3, 2.8, 0, 0.05),
    basic: 'warrior_strike', actives: ['shield_bash'], model: 'Skeleton_Warrior',
    gear: { weapon: 'Axe', offhand: 'Shield_Small', helmet: true, cape: false },
  },
  {
    id: 'skeleton_archer', role: 'ranged', base: stats(70, 11, 5, 0.85, 7, 3.0, 0.05, 0.05),
    basic: 'bolt_shot', actives: [], model: 'Skeleton_Rogue',
    gear: { weapon: 'Crossbow', helmet: true, cape: false },
  },
  {
    id: 'skeleton_mage', role: 'caster', base: stats(70, 13, 5, 0.8, 6.5, 2.9, 0, 0.05),
    basic: 'arcane_bolt', actives: ['grave_bolt'], model: 'Skeleton_Mage',
    gear: { weapon: 'Staff', helmet: true, cape: false },
  },
  {
    id: 'ashen_knight', role: 'vanguard', base: stats(1600, 24, 25, 0.8, 2.2, 2.8, 0, 0.05),
    basic: 'heavy_cleave', actives: ['crushing_slam', 'ashen_charge', 'raise_dead'], model: 'Skeleton_Warrior',
    gear: { weapon: 'Axe', offhand: 'Shield_Large', helmet: true, cape: true }, scale: 1.8, boss: true,
    phases: [{ hpBelow: 0.5, statMult: { atkSpeed: 1.25, moveSpeed: 1.15 }, areaMult: 1.3 }],
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(list.map((e) => [e.id, e]));
