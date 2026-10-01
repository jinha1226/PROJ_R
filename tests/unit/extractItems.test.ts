import { describe, it, expect } from 'vitest';
import { X_ITEMS, xitem, STARTER_KIT, GEAR_SLOTS } from '../../src/data/extract';
import type { WeaponType } from '../../src/data/types';

const all = Object.values(X_ITEMS);
const WEAPON_TYPES: WeaponType[] = ['sword_shield', 'axe2h', 'daggers', 'crossbow', 'staff', 'wand'];

describe('extraction items', () => {
  it('ids are unique and every item has value, weight, and a legal stack size', () => {
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    for (const i of all) {
      expect(i.value, i.id).toBeGreaterThan(0);
      expect(i.weight, i.id).toBeGreaterThanOrEqual(0);
      expect([1, 3, 5]).toContain(i.stack);
    }
    expect(() => xitem('nope')).toThrow();
  });

  it('every gear item has a slot, and value rises with tier within a slot', () => {
    for (const slot of GEAR_SLOTS) {
      const gear = all.filter((i) => i.kind === 'gear' && i.slot === slot);
      expect(gear.length, slot).toBeGreaterThanOrEqual(4);
      const byTier = new Map<number, number[]>();
      for (const g of gear) byTier.set(g.tier, [...(byTier.get(g.tier) ?? []), g.value]);
      const tiers = [...byTier.keys()].sort();
      for (let k = 1; k < tiers.length; k++) expect(Math.min(...byTier.get(tiers[k]!)!)).toBeGreaterThan(Math.max(...byTier.get(tiers[k - 1]!)!));
    }
    expect(all.filter((i) => i.kind === 'gear').every((i) => !!i.slot)).toBe(true);
  });

  it('each weapon type has a worn tier-0 weapon and at least three weapons', () => {
    for (const t of WEAPON_TYPES) {
      const ws = all.filter((i) => i.slot === 'weapon' && i.weaponType === t);
      expect(ws.length, t).toBeGreaterThanOrEqual(3);
      expect(ws.some((w) => w.tier === 0), t).toBe(true);
    }
  });

  it('bags and belts follow the spec numbers', () => {
    const bags = all.filter((i) => i.slot === 'bag').map((i) => i.bag!.slots).sort((a, b) => a - b);
    expect(bags).toEqual([6, 10, 14, 18]);
    const belts = all.filter((i) => i.slot === 'belt').map((i) => i.belt!.quickSlots).sort();
    expect(belts).toEqual([1, 2, 3, 4]);
  });

  it('has the consumables, goods, relics and a vault key the sorties need', () => {
    const uses = new Set(all.filter((i) => i.kind === 'consumable').map((i) => i.use!.kind));
    expect([...uses].sort()).toEqual(['antidote', 'heal', 'recall', 'smoke']);
    expect(all.filter((i) => i.kind === 'part').length).toBeGreaterThanOrEqual(4);
    expect(all.filter((i) => i.kind === 'junk').length).toBeGreaterThanOrEqual(6);
    const relics = all.filter((i) => i.kind === 'relic');
    expect(relics.length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...relics.map((r) => r.weight))).toBeGreaterThanOrEqual(3);
    expect(all.some((i) => i.kind === 'key')).toBe(true);
  });

  it('the free starter kit covers every class weapon and a chest piece', () => {
    for (const t of WEAPON_TYPES) expect(xitem(STARTER_KIT.weapon[t]).tier).toBe(0);
    expect(xitem(STARTER_KIT.chest).slot).toBe('chest');
  });
});
