import type { EngraveId } from './engraveCore';
import type { Material } from './materials';
import type { Rng } from '../../core/rng';
import type { PotionKind, ScrollKind } from './lore';

export type WeaponGroup = 'dagger' | 'sword' | 'axe' | 'spear' | 'mace' | 'pistol';
export type GunGroup = 'pistol';
export const GUNS: GunGroup[] = ['pistol'];
export const GUN_COST: Record<GunGroup, number> = { pistol: 1 };
export const isGun = (g: WeaponGroup): g is GunGroup => GUNS.includes(g as GunGroup);
export type Element = 'fire' | 'frost' | 'shock' | 'poison';
export interface Weapon {
  kind: 'weapon';
  group: WeaponGroup;
  tier: 1 | 2;
  name: string;
}
export interface Armor { kind: 'armor'; tier: 1 | 2 | 3; name: string; reduce: number }
export type Equipment = Weapon | Armor;
/** A potion or scroll lying on the floor (picked up into the pack, not the bag). */
export type Consumable = { kind: 'potion'; p: PotionKind; name: string } | { kind: 'scroll'; sc: ScrollKind; name: string };
/** The final guardian's energy source; picking it up ends the run. */
export interface StoneItem { kind: 'stone'; id: string; name: string }
export interface Core { kind: 'core'; name: '에너지원' }
export interface MaterialItem { kind: 'material'; mat: Material; n: number }
export interface LostSuit { kind: 'suit'; ids: EngraveId[]; name: '남겨진 슈트' }
export type BeltItem = 'potion' | 'bomb' | 'fireFlask' | 'frostFlask' | 'shockFlask' | 'poisonFlask';
export const BELT_ITEMS: BeltItem[] = ['potion', 'bomb', 'fireFlask', 'frostFlask', 'shockFlask', 'poisonFlask'];

type Range2 = [[number, number], [number, number]];
/** One line per weapon group (tier 1 / tier 2 damage). Same tier ≈ same damage per turn. */
export const WEAPONS: Record<WeaponGroup, { melee: boolean; dmg: Range2; hit: number; time: number; range?: number }> = {
  dagger: { melee: true, dmg: [[3, 5], [5, 7]], hit: 0.92, time: 0.7 },
  sword: { melee: true, dmg: [[6, 9], [8, 12]], hit: 0.9, time: 1 },
  axe: { melee: true, dmg: [[7, 11], [9, 14]], hit: 0.85, time: 1.4 },
  spear: { melee: true, dmg: [[5, 8], [7, 11]], hit: 0.88, time: 1 },
  mace: { melee: true, dmg: [[6, 9], [8, 12]], hit: 0.85, time: 1.2 },
  pistol: { melee: false, dmg: [[4, 6], [4, 6]], hit: 0.9, time: 0.6, range: 7 },
};
const NAMES: Record<WeaponGroup, [string, string]> = {
  dagger: ['단검', '날 선 단검'], sword: ['장검', '기사검'], axe: ['전투 도끼', '양날 도끼'], spear: ['창', '기병창'], mace: ['철퇴', '가시 철퇴'],
  pistol: ['권총', '권총'],
};
const ARMORS: Armor[] = [
  { kind: 'armor', tier: 1, name: '가죽 갑옷', reduce: 1 },
  { kind: 'armor', tier: 2, name: '사슬 갑옷', reduce: 2 },
  { kind: 'armor', tier: 3, name: '판금 갑옷', reduce: 3 },
];
const MELEE: WeaponGroup[] = ['dagger', 'sword', 'axe', 'spear', 'mace'];
const LOCAL: WeaponGroup[] = MELEE;
/** chance of a tier-2 find on floors 1, 2, 3 */
const TIER2 = [0.1, 0.35, 0.6];

export function makeWeapon(group: WeaponGroup, tier: 1 | 2): Weapon {
  if (isGun(group)) tier = 1;
  const w: Weapon = { kind: 'weapon', group, tier, name: NAMES[group][tier - 1]! };
  return w;
}

/** The agent's suit: worn from the start, never taken off (it grows at the ship, not from finds). */
export const SUIT_NAME = '요원 슈트';
export const agentSuit = (): Armor => ({ kind: 'armor', tier: 1, name: SUIT_NAME, reduce: 1 });

export function armorOf(tier: 1 | 2 | 3): Armor {
  return { ...ARMORS[tier - 1]! };
}

/** A random find: one of the five local weapon groups with equal weight (no armour — the agent wears the suit). */
export function rollEquipment(rng: Rng, floor: number): Weapon {
  const t2 = TIER2[Math.min(TIER2.length, Math.max(1, floor)) - 1]!;
  const group = rng.pick(LOCAL);
  return makeWeapon(group, rng.chance(t2) ? 2 : 1);
}
