import type { EngraveId } from './engraveCore';
import type { Material } from './materials';
import type { Rng } from '../../core/rng';
import type { PotionKind, ScrollKind } from './lore';

export type WeaponGroup = 'dagger' | 'sword' | 'axe' | 'spear' | 'mace' | 'bow' | 'staff';
export type RangedGroup = 'bow' | 'staff';
/** Legacy loadout input only; weapons themselves never have group pistol. */
export type GunGroup = RangedGroup | 'pistol';
export const isRanged = (g: WeaponGroup): g is RangedGroup => g === 'bow' || g === 'staff';
export const isGun = isRanged;
export const GUNS: RangedGroup[] = ['bow', 'staff'];
export const GUN_COST: Record<RangedGroup, number> = { bow: 0, staff: 2 };
export const MAX_ARROWS = 40;
export type Element = 'fire' | 'frost' | 'shock' | 'poison';
export interface Weapon {
  kind: 'weapon';
  element?: Element;
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
  bow: { melee: false, dmg: [[5, 8], [7, 11]], hit: 0.86, time: 1, range: 8 },
  staff: { melee: false, dmg: [[4, 6], [6, 9]], hit: 0.95, time: 1, range: 6 },
};
const NAMES: Record<WeaponGroup, [string, string]> = {
  dagger: ['단검', '날 선 단검'], sword: ['장검', '기사검'], axe: ['전투 도끼', '양날 도끼'], spear: ['창', '기병창'], mace: ['철퇴', '가시 철퇴'],
  bow: ['사냥 활', '장궁'], staff: ['견습 지팡이', '마도사 지팡이'],
};
const ARMORS: Armor[] = [
  { kind: 'armor', tier: 1, name: '가죽 갑옷', reduce: 1 },
  { kind: 'armor', tier: 2, name: '사슬 갑옷', reduce: 2 },
  { kind: 'armor', tier: 3, name: '판금 갑옷', reduce: 3 },
];
const MELEE: WeaponGroup[] = ['dagger', 'sword', 'axe', 'spear', 'mace'];
/** chance of a tier-2 find on floors 1, 2, 3 */
const TIER2 = [0.1, 0.35, 0.6];

export function makeWeapon(group: WeaponGroup, tier: 1 | 2): Weapon {
  const w: Weapon = { kind: 'weapon', group, tier, name: NAMES[group][tier - 1]! };
  return w;
}

/** The agent's suit: worn from the start, never taken off (it grows at the ship, not from finds). */
export const SUIT_NAME = '요원 슈트';
export const agentSuit = (): Armor => ({ kind: 'armor', tier: 1, name: SUIT_NAME, reduce: 1 });

export function armorOf(tier: 1 | 2 | 3): Armor {
  return { ...ARMORS[tier - 1]! };
}

/** A random weapon: 60% melee, 20% bow, 20% elemental staff; tier follows floor. */
export function rollEquipment(rng: Rng, floor: number): Weapon {
  const t2 = TIER2[Math.min(TIER2.length, Math.max(1, floor)) - 1]!;
  const roll = rng.next();
  const group = roll < 0.6 ? rng.pick(MELEE) : roll < 0.8 ? 'bow' : 'staff';
  const w = makeWeapon(group, rng.chance(t2) ? 2 : 1);
  if (group === 'staff') w.element = rng.pick(['fire', 'frost', 'shock', 'poison']);
  return w;
}
