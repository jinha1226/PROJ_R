import { describe, it, expect } from 'vitest';
import {
  addItem, bagSlots, carriedValue, carryLimit, emptyLoadout, equipFromBag, loseOnDeath, moveToQuick, quickSlots, removeAt,
  speedMult, totalWeight, unequipToBag, type Loadout,
} from '../../src/sim/extract/loadout';
import { xitem } from '../../src/data/extract';

const count = (l: Loadout, extra: { id: string; n: number }[] = []) => {
  const all = [...l.bag, ...l.quick.filter((q): q is NonNullable<typeof q> => !!q), ...(l.pouch ? [l.pouch] : []), ...Object.values(l.equipped).map((id) => ({ id: id!, n: 1 })), ...extra];
  return all.reduce((m, s) => m.set(s.id, (m.get(s.id) ?? 0) + s.n), new Map<string, number>());
};

describe('loadout: slots, weight, and value', () => {
  it('a bare loadout has the pocket defaults', () => {
    const l = emptyLoadout();
    expect([bagSlots(l), carryLimit(l), quickSlots(l)]).toEqual([6, 15, 1]);
    expect(totalWeight(l)).toBe(0);
  });

  it('stacks first, then fills slots, and refuses what does not fit', () => {
    let l = emptyLoadout();
    let r = addItem(l, 'x_bone', 7);
    expect(r.added).toBe(7);
    l = r.loadout;
    expect(l.bag).toEqual([{ id: 'x_bone', n: 5 }, { id: 'x_bone', n: 2 }]);
    for (let i = 0; i < 4; i++) l = addItem(l, 'x_lute', 1).loadout;
    expect(l.bag.length).toBe(6);
    r = addItem(l, 'x_spoon', 1);
    expect(r.added).toBe(0);
    r = addItem(l, 'x_bone', 5);
    expect(r.added).toBe(3);
  });

  it('weight caps pickups and slows the carrier', () => {
    let l = addItem(emptyLoadout(), 'x_idol', 1).loadout; // 6
    l = addItem(l, 'x_grail', 1).loadout;                  // 10
    expect(totalWeight(l)).toBe(10);
    expect(speedMult(l)).toBeCloseTo(1 - 0.3 * ((10 / 15 - 0.6) / 0.4));
    expect(addItem(l, 'x_reliquary', 1).added).toBe(0);    // 17 > 15
    const light = addItem(emptyLoadout(), 'x_cup', 1).loadout;
    expect(speedMult(light)).toBe(1);
  });

  it('carried value counts what can be lost, not the pouch', () => {
    let l = addItem(emptyLoadout(), 'x_crown', 1).loadout;
    l = { ...l, pouch: { id: 'x_idol', n: 1 }, equipped: { weapon: 'x_daggers_1' } };
    expect(carriedValue(l)).toBe(xitem('x_crown').value + xitem('x_daggers_1').value);
  });
});

describe('loadout: equipping in the field', () => {
  it('equips from the bag and puts the old piece back in the bag', () => {
    let l: Loadout = { ...emptyLoadout(), equipped: { weapon: 'x_sword_shield_0' } };
    l = addItem(l, 'x_sword_shield_2', 1).loadout;
    const r = equipFromBag(l, 0, 'sword_shield');
    expect(r.loadout.equipped.weapon).toBe('x_sword_shield_2');
    expect(r.loadout.bag).toEqual([{ id: 'x_sword_shield_0', n: 1 }]);
    expect(r.dropped).toEqual([]);
  });

  it('refuses a weapon of the wrong type and non-gear', () => {
    const l = addItem(addItem(emptyLoadout(), 'x_staff_1', 1).loadout, 'x_cup', 1).loadout;
    expect(() => equipFromBag(l, 0, 'daggers')).toThrow();
    expect(() => equipFromBag(l, 1, 'daggers')).toThrow();
  });

  it('taking off a bigger bag spills what no longer fits on the ground — nothing vanishes', () => {
    let l: Loadout = { ...emptyLoadout(), equipped: { bag: 'x_bag_2' } }; // 14 slots
    for (let i = 0; i < 12; i++) l = addItem(l, 'x_lute', 1).loadout;   // 12 slots, 24 kg... limit 40
    l = addItem(l, 'x_bag_0', 1).loadout;                                 // 13th slot
    const before = count(l);
    const r = equipFromBag(l, 12, 'daggers');                             // swap to 6-slot sack
    expect(r.loadout.bag.length).toBeLessThanOrEqual(6);
    expect(r.dropped.length).toBeGreaterThan(0);
    expect(count(r.loadout, r.dropped)).toEqual(before);
  });

  it('a smaller belt pushes extra quick slots into the bag (or the ground)', () => {
    let l: Loadout = { ...emptyLoadout(), equipped: { belt: 'x_belt_2' }, quick: [{ id: 'x_potion_s', n: 3 }, { id: 'x_antidote', n: 1 }, null] };
    l = addItem(l, 'x_belt_0', 1).loadout;
    const before = count(l);
    const r = equipFromBag(l, 0, 'daggers');
    expect(r.loadout.quick.length).toBe(1);
    expect(count(r.loadout, r.dropped)).toEqual(before);
  });

  it('moves consumables to quick slots and gear back to the bag', () => {
    let l = addItem(emptyLoadout(), 'x_potion_m', 2).loadout;
    l = moveToQuick(l, 0, 0);
    expect(l.quick[0]).toEqual({ id: 'x_potion_m', n: 2 });
    expect(() => moveToQuick(addItem(emptyLoadout(), 'x_cup', 1).loadout, 0, 0)).toThrow();
    const worn: Loadout = { ...emptyLoadout(), equipped: { head: 'x_head_1' } };
    expect(unequipToBag(worn, 'head').loadout.bag).toEqual([{ id: 'x_head_1', n: 1 }]);
    const r = removeAt(l, 'quick', 0, 1);
    expect(r.taken).toEqual({ id: 'x_potion_m', n: 1 });
    expect(r.loadout.quick[0]).toEqual({ id: 'x_potion_m', n: 1 });
  });

  it('dying keeps only the safe pouch', () => {
    const l: Loadout = { equipped: { weapon: 'x_axe2h_3', bag: 'x_bag_3' }, bag: [{ id: 'x_crown', n: 1 }], quick: [{ id: 'x_potion_s', n: 2 }], pouch: { id: 'x_idol', n: 1 } };
    expect(loseOnDeath(l)).toEqual({ equipped: {}, bag: [], quick: [null], pouch: { id: 'x_idol', n: 1 } });
  });
});
