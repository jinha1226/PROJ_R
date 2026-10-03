import type { Rng } from '../../core/rng';
import type { Engraving } from './engraveCore';

export type WeaponGroup = 'dagger' | 'sword' | 'axe' | 'spear' | 'mace' | 'bow' | 'crossbow' | 'throwing' | 'staff';
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
  /** throwing */
  stack?: number;
  engraves?: Engraving[];
}
export interface Armor { kind: 'armor'; tier: 1 | 2 | 3; name: string; reduce: number }
export type Equipment = Weapon | Armor;
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
  bow: { melee: false, dmg: [[4, 7], [6, 9]], hit: 0.8, time: 1, range: 7 },
  crossbow: { melee: false, dmg: [[6, 10], [9, 13]], hit: 0.85, time: 1.6, range: 8 },
  throwing: { melee: false, dmg: [[4, 6], [5, 8]], hit: 0.85, time: 1, range: 5 },
  staff: { melee: false, dmg: [[5, 8], [7, 10]], hit: 0.85, time: 1, range: 6 },
};
export const STAFF_CHARGES = 3;
export const STAFF_RECHARGE = 8;
export const THROW_STACK = 6;

const NAMES: Record<WeaponGroup, [string, string]> = {
  dagger: ['단검', '날 선 단검'], sword: ['장검', '기사검'], axe: ['전투 도끼', '양날 도끼'], spear: ['창', '기병창'], mace: ['철퇴', '가시 철퇴'],
  bow: ['짧은 활', '긴 활'], crossbow: ['석궁', '무거운 석궁'], throwing: ['투척 단검', '균형 투척 단검'], staff: ['지팡이', '룬 지팡이'],
};
const STAFF_NAME: Record<Element, string> = { fire: '화염', frost: '서리', shock: '번개', poison: '독' };
const ARMORS: Armor[] = [
  { kind: 'armor', tier: 1, name: '가죽 갑옷', reduce: 1 },
  { kind: 'armor', tier: 2, name: '사슬 갑옷', reduce: 2 },
  { kind: 'armor', tier: 3, name: '판금 갑옷', reduce: 3 },
];
const MELEE: WeaponGroup[] = ['dagger', 'sword', 'axe', 'spear', 'mace'];
const RANGED: WeaponGroup[] = ['bow', 'crossbow', 'throwing', 'staff'];
const ELEMENTS: Element[] = ['fire', 'frost', 'shock', 'poison'];
/** chance of a tier-2 find on floors 1, 2, 3 */
const TIER2 = [0.1, 0.35, 0.6];

export function makeWeapon(group: WeaponGroup, tier: 1 | 2, element?: Element): Weapon {
  const w: Weapon = { kind: 'weapon', group, tier, name: NAMES[group][tier - 1]! };
  if (group === 'staff') { w.element = element ?? 'fire'; w.charges = STAFF_CHARGES; w.name = `${STAFF_NAME[w.element]} ${w.name}`; }
  if (group === 'throwing') w.stack = THROW_STACK;
  return w;
}

export function armorOf(tier: 1 | 2 | 3): Armor {
  return { ...ARMORS[tier - 1]! };
}

/** A random find: one in five is armour; weapons are an even split between melee and ranged groups. */
export function rollEquipment(rng: Rng, floor: number): Equipment {
  const t2 = TIER2[Math.min(TIER2.length, Math.max(1, floor)) - 1]!;
  if (rng.chance(0.2)) return armorOf(rng.chance(t2) ? (rng.chance(0.3) ? 3 : 2) : 1);
  const group = rng.pick(rng.chance(0.5) ? MELEE : RANGED);
  return makeWeapon(group, rng.chance(t2) ? 2 : 1, group === 'staff' ? rng.pick(ELEMENTS) : undefined);
}
