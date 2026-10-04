import type { EngraveId } from './engraveCore';
import type { Family } from './absorb';
import type { Rng } from '../../core/rng';
import type { PotionKind, ScrollKind } from './lore';

export type WeaponGroup = 'dagger' | 'sword' | 'axe' | 'spear' | 'mace' | 'pistol' | 'shotgun' | 'rifle' | 'staff';
export type GunGroup = 'pistol' | 'shotgun' | 'rifle';
export const GUNS: GunGroup[] = ['pistol', 'shotgun', 'rifle'];
export const GUN_COST: Record<GunGroup, number> = { pistol: 1, shotgun: 2, rifle: 2 };
export const isGun = (g: WeaponGroup): g is GunGroup => GUNS.includes(g as GunGroup);
export type Element = 'fire' | 'frost' | 'shock' | 'poison';
export interface Weapon {
  kind: 'weapon';
  group: WeaponGroup;
  tier: 1 | 2;
  name: string;
  /** staffs only */
  element?: Element;
  /** staff */
  charges?: number;
}
export interface Armor { kind: 'armor'; tier: 1 | 2 | 3; name: string; reduce: number }
export type Equipment = Weapon | Armor;
/** A potion or scroll lying on the floor (picked up into the pack, not the bag). */
export type Consumable = { kind: 'potion'; p: PotionKind; name: string } | { kind: 'scroll'; sc: ScrollKind; name: string };
/** The final guardian's energy source; picking it up ends the run. */
export interface Core { kind: 'core'; name: '에너지원' }
/** An elite or guardian's engraving choice, absorbed on contact. */
export interface Echo { kind: 'echo'; family: Family; name: '잔향' }
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
  shotgun: { melee: false, dmg: [[5, 8], [5, 8]], hit: 0.9, time: 1, range: 4 },
  // per bullet: a rifle shot is a burst of RIFLE_BURST
  rifle: { melee: false, dmg: [[3, 5], [3, 5]], hit: 0.85, time: 1.2, range: 9 },
  staff: { melee: false, dmg: [[5, 8], [7, 10]], hit: 0.85, time: 1, range: 6 },
};
export const RIFLE_BURST = 3;
/** game time between a burst's bullets (they play out one after another) */
export const BURST_GAP = 0.4;
/** A shotgun blast by distance: brutal point-blank, weak at the edge of its reach. */
export const shotgunFalloff = (cells: number): number => (cells <= 1 ? 1.5 : cells === 2 ? 1 : 0.6);
export const STAFF_CHARGES = 3;
export const STAFF_RECHARGE = 8;

const NAMES: Record<WeaponGroup, [string, string]> = {
  dagger: ['단검', '날 선 단검'], sword: ['장검', '기사검'], axe: ['전투 도끼', '양날 도끼'], spear: ['창', '기병창'], mace: ['철퇴', '가시 철퇴'],
  pistol: ['권총', '권총'], shotgun: ['산탄총', '산탄총'], rifle: ['소총', '소총'], staff: ['지팡이', '룬 지팡이'],
};
const STAFF_NAME: Record<Element, string> = { fire: '화염', frost: '서리', shock: '번개', poison: '독' };
const ARMORS: Armor[] = [
  { kind: 'armor', tier: 1, name: '가죽 갑옷', reduce: 1 },
  { kind: 'armor', tier: 2, name: '사슬 갑옷', reduce: 2 },
  { kind: 'armor', tier: 3, name: '판금 갑옷', reduce: 3 },
];
const MELEE: WeaponGroup[] = ['dagger', 'sword', 'axe', 'spear', 'mace'];
const LOCAL: WeaponGroup[] = [...MELEE, 'staff'];
const ELEMENTS: Element[] = ['fire', 'frost', 'shock', 'poison'];
/** chance of a tier-2 find on floors 1, 2, 3 */
const TIER2 = [0.1, 0.35, 0.6];

export function makeWeapon(group: WeaponGroup, tier: 1 | 2, element?: Element): Weapon {
  if (isGun(group)) tier = 1;
  const w: Weapon = { kind: 'weapon', group, tier, name: NAMES[group][tier - 1]! };
  if (group === 'staff') { w.element = element ?? 'fire'; w.charges = STAFF_CHARGES; w.name = `${STAFF_NAME[w.element]} ${w.name}`; }
  return w;
}

/** The agent's suit: worn from the start, never taken off (it grows at the ship, not from finds). */
export const SUIT_NAME = '요원 슈트';
export const agentSuit = (): Armor => ({ kind: 'armor', tier: 1, name: SUIT_NAME, reduce: 1 });

export function armorOf(tier: 1 | 2 | 3): Armor {
  return { ...ARMORS[tier - 1]! };
}

/** A random find: one of the six local weapon groups with equal weight (no armour — the agent wears the suit). */
export function rollEquipment(rng: Rng, floor: number): Weapon {
  const t2 = TIER2[Math.min(TIER2.length, Math.max(1, floor)) - 1]!;
  const group = rng.pick(LOCAL);
  return makeWeapon(group, rng.chance(t2) ? 2 : 1, group === 'staff' ? rng.pick(ELEMENTS) : undefined);
}
