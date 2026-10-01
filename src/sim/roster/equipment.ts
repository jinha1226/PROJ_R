import { getItem, WEAPON_TYPE_OF_CLASS } from '../../data/items';
import type { ItemSlot } from '../../data/types';
import type { Mercenary, Roster } from './types';

export function canEquip(m: Mercenary, itemId: string): boolean {
  const item = getItem(itemId);
  return item.slot !== 'weapon' || item.weaponType === WEAPON_TYPE_OF_CLASS[m.classId];
}

const replaceMerc = (r: Roster, m: Mercenary): Roster => ({ ...r, mercs: r.mercs.map((x) => (x.id === m.id ? m : x)) });

/** Equips an inventory item; the previously worn item goes back to the inventory. */
export function equip(r: Roster, mercId: string, itemId: string): Roster {
  const m = r.mercs.find((x) => x.id === mercId);
  const idx = r.inventory.indexOf(itemId);
  if (!m || idx < 0) throw new Error(`cannot equip ${itemId}: not in inventory`);
  if (!canEquip(m, itemId)) throw new Error(`cannot equip ${itemId}: wrong weapon type for ${m.classId}`);
  const slot = getItem(itemId).slot;
  const inventory = r.inventory.filter((_, i) => i !== idx);
  const old = m.gear[slot];
  if (old) inventory.push(old);
  return replaceMerc({ ...r, inventory }, { ...m, gear: { ...m.gear, [slot]: itemId } });
}

export function unequip(r: Roster, mercId: string, slot: ItemSlot): Roster {
  const m = r.mercs.find((x) => x.id === mercId);
  const old = m?.gear[slot];
  if (!m || !old) return r;
  const gear = { ...m.gear };
  delete gear[slot];
  return replaceMerc({ ...r, inventory: [...r.inventory, old] }, { ...m, gear });
}
