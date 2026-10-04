import type { PotionKind, ScrollKind } from './lore';
import { agentSuit, makeWeapon, SUIT_NAME, type GunGroup, type Armor, type BeltItem, type Equipment, type Weapon } from './items';

export const BAG_SIZE = 8;

export interface Gear {
  hands: [Weapon | null, Weapon | null];
  active: 0 | 1;
  bag: Equipment[];
  armor: Armor | null;
  belt: Record<BeltItem, number>;
  potions: Partial<Record<PotionKind, number>>;
  scrolls: Partial<Record<ScrollKind, number>>;
}

/** Ship loadout: a gun, an agent knife, the agent's suit and two potions. */
export function startGear(gun: GunGroup = 'pistol'): Gear {
  const weapon = makeWeapon(gun, 1);
  const belt = { potion: 2, bomb: 0, fireFlask: 0, frostFlask: 0, shockFlask: 0, poisonFlask: 0 };
  return { hands: [weapon, { ...makeWeapon('dagger', 1), name: '요원 칼' }], active: 0, bag: [], armor: agentSuit(), belt, potions: {}, scrolls: {} };
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
  // the agent never takes the suit off
  if (!e || e.kind !== 'armor' || g.armor?.name === SUIT_NAME) return false;
  const old = g.armor;
  g.armor = e;
  if (old) g.bag[i] = old;
  else g.bag.splice(i, 1);
  return true;
}
