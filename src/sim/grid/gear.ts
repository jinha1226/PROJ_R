import { armorOf, makeWeapon, type Armor, type BeltItem, type Equipment, type Weapon } from './items';

export type ClassId = 'warrior' | 'hunter' | 'mage';
export const BAG_SIZE = 8;

export interface Gear {
  hands: [Weapon | null, Weapon | null];
  active: 0 | 1;
  bag: Equipment[];
  armor: Armor | null;
  belt: Record<BeltItem, number>;
  arrows: number;
  cls: ClassId;
}

/** Leanings, not locks: every class can use every weapon. */
export const CLASS_BONUS: Record<ClassId, { meleeDmg: number; maxHp: number; rangedHit: number; reload: number; charges: number; recharge: number; statusTurns: number }> = {
  warrior: { meleeDmg: 1.2, maxHp: 10, rangedHit: 0, reload: 1, charges: 0, recharge: 1, statusTurns: 0 },
  hunter: { meleeDmg: 1, maxHp: 0, rangedHit: 0.1, reload: 0.75, charges: 0, recharge: 1, statusTurns: 0 },
  mage: { meleeDmg: 1, maxHp: 0, rangedHit: 0, reload: 1, charges: 1, recharge: 2, statusTurns: 1 },
};
export const CLASS_NAME: Record<ClassId, string> = { warrior: '전사', hunter: '사냥꾼', mage: '마법사' };

const emptyBelt = (): Record<BeltItem, number> => ({ potion: 0, bomb: 0, fireFlask: 0, frostFlask: 0, shockFlask: 0, poisonFlask: 0 });

export function startGear(cls: ClassId): Gear {
  const belt = emptyBelt();
  if (cls === 'warrior') {
    belt.potion = 2;
    return { hands: [makeWeapon('sword', 1), makeWeapon('crossbow', 1)], active: 0, bag: [], armor: armorOf(1), belt, arrows: 10, cls };
  }
  if (cls === 'hunter') {
    belt.potion = 1;
    return { hands: [makeWeapon('bow', 1), makeWeapon('dagger', 1)], active: 0, bag: [], armor: null, belt, arrows: 20, cls };
  }
  belt.potion = 1;
  belt.fireFlask = 1;
  belt.frostFlask = 1;
  const staff = makeWeapon('staff', 1, 'fire');
  staff.charges = (staff.charges ?? 0) + CLASS_BONUS.mage.charges;
  return { hands: [staff, makeWeapon('dagger', 1)], active: 0, bag: [], armor: null, belt, arrows: 0, cls };
}

export const activeWeapon = (g: Gear): Weapon | null => g.hands[g.active];

export function swapHands(g: Gear): void {
  g.active = g.active === 0 ? 1 : 0;
}

export function addToBag(g: Gear, e: Equipment): boolean {
  if (g.bag.length >= BAG_SIZE) return false;
  g.bag.push(e);
  return true;
}

/** Takes a weapon from the bag into the hand in use; whatever was there goes into the bag. */
export function equipFromBag(g: Gear, i: number): boolean {
  const e = g.bag[i];
  if (!e || e.kind !== 'weapon') return false;
  const old = g.hands[g.active];
  g.hands[g.active] = e;
  if (old) g.bag[i] = old;
  else g.bag.splice(i, 1);
  return true;
}

export function wearFromBag(g: Gear, i: number): boolean {
  const e = g.bag[i];
  if (!e || e.kind !== 'armor') return false;
  const old = g.armor;
  g.armor = e;
  if (old) g.bag[i] = old;
  else g.bag.splice(i, 1);
  return true;
}
