import { alive, entOf, unitOf, type Unit } from '../party/partyCore';
import { CLASSES, type ClassId } from '../party/partyDefs';
import { refitHp } from '../party/partyLevel';
import type { GEvent } from '../grid/types';
import type { RoamParty } from '../roam/roam';
import { ARMORS, type AffixId, type Item, type TrinketId } from './items';

export interface Loadout {
  weapon: Item & { kind: 'weapon' };
  armor: (Item & { kind: 'armor' }) | null;
  trinkets: [TrinketId | null, TrinketId | null];
}
export const PACK_SIZE = 16;
export const nextItemId = (p: RoamParty): string => `item-${p.nextItem++}`;
const affixes = (u: Unit, id: AffixId): number => [u.gear?.weapon, u.gear?.armor].filter((i) => i?.affix === id).length;
const armor = (u: Unit) => u.gear?.armor ? ARMORS[u.gear.armor.base] : undefined;
const wears = (u: Unit, t: TrinketId): boolean => u.gear?.trinkets.includes(t) ?? false;
export const G = {
  wears,
  dmg: (u: Unit): number => (u.gear && u.gear.weapon.rarity !== 'common' ? 1.15 : 1) * 1.15 ** affixes(u, 'keen'),
  atk: (u: Unit): number => (armor(u)?.atkMul ?? 1) * 0.88 ** affixes(u, 'quick') * (wears(u, 'swift') ? 0.85 : 1),
  move: (u: Unit): number => armor(u)?.moveMul ?? 1,
  reduce: (u: Unit): number => (armor(u)?.reduce ?? 0) + (u.gear?.armor && u.gear.armor.rarity !== 'common' ? 0.05 : 0),
  hp: (u: Unit): number => 15 * affixes(u, 'sturdy') + (wears(u, 'bulwark') ? 20 : 0),
  cd: (u: Unit): number => 0.85 ** affixes(u, 'focused') * (wears(u, 'focus') ? 0.8 : 1) * (u.cls && CLASSES[u.cls].magic ? armor(u)?.magicCdMul ?? 1 : 1),
  healTaken: (u: Unit): number => 1.25 ** affixes(u, 'vital'),
};
export function starterGear(cls: ClassId, nextId: () => string): Loadout {
  return {
    weapon: { id: nextId(), kind: 'weapon', base: CLASSES[cls].weapons[0]!, rarity: 'common' },
    armor: cls === 'shell' ? null : { id: nextId(), kind: 'armor', base: ['warrior', 'cleric'].includes(cls) ? 'leather' : 'cloth', rarity: 'common' },
    trinkets: [null, null],
  };
}
export function canEquip(u: Unit, it: Item): boolean {
  if (u.side !== 'hero' || !u.cls) return false;
  if (it.kind === 'weapon') return CLASSES[u.cls].weapons.includes(it.base);
  return it.kind !== 'trinket' || !G.wears(u, it.base);
}
/** Gear changes clamp current health; level gains retain the ordinary health-gap rule. */
function refitGear(p: RoamParty, u: Unit): void {
  const e = entOf(p, u.id)!, hp = e.hp;
  refitHp(p, u);
  e.hp = Math.max(1, Math.min(hp, e.maxHp));
}
export function equip(p: RoamParty, heroId: string, itemId: string, slot: 0 | 1 = 0): boolean {
  const u = unitOf(p, heroId), i = p.pack.findIndex((it) => it.id === itemId), it = p.pack[i];
  if (!u || !alive(p, u) || !u.gear || !it || !canEquip(u, it)) return false;
  let old: Item | null;
  if (it.kind === 'weapon') { old = u.gear.weapon; u.gear.weapon = it; u.weapon = it.base; }
  else if (it.kind === 'armor') { old = u.gear.armor; u.gear.armor = it; }
  else {
    const base = u.gear.trinkets[slot];
    old = base ? { id: nextItemId(p), kind: 'trinket', base } : null;
    u.gear.trinkets[slot] = it.base;
  }
  p.pack.splice(i, 1);
  if (old) p.pack.push(old);
  refitGear(p, u);
  return true;
}
export function unequip(p: RoamParty, heroId: string, slot: 'armor' | 0 | 1): boolean {
  const u = unitOf(p, heroId);
  if (!u?.gear || !alive(p, u) || p.pack.length >= PACK_SIZE) return false;
  if (slot === 'armor') {
    if (!u.gear.armor) return false;
    p.pack.push(u.gear.armor); u.gear.armor = null;
  } else {
    const base = u.gear.trinkets[slot];
    if (!base) return false;
    p.pack.push({ id: nextItemId(p), kind: 'trinket', base }); u.gear.trinkets[slot] = null;
  }
  refitGear(p, u);
  return true;
}
export function drink(p: RoamParty, heroId: string): GEvent[] {
  const u = unitOf(p, heroId);
  if (!u || u.side !== 'hero' || !alive(p, u) || p.potions <= 0) return [];
  const e = entOf(p, heroId)!, amount = Math.min(e.maxHp - e.hp, Math.round(e.maxHp * 0.4 * G.healTaken(u)));
  p.potions--; e.hp += amount; u.nextAt = Math.max(p.time, u.nextAt) + 0.6;
  if (p.manual === heroId) p.waiting = false;
  return [{ t: p.time, type: 'drink', src: heroId }, { t: p.time, type: 'heal', src: heroId, dst: heroId, amount }];
}
