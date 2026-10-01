import { describe, it, expect } from 'vitest';
import { bagSlots, carryLimit, emptyLoadout, partyPack, settleCapacity, speedMult, totalWeight, addItem, type Loadout } from '../../src/sim/extract/loadout';
import { xitem } from '../../src/data/extract';

const member = (eq: Loadout['equipped']): Loadout => ({ ...emptyLoadout(), equipped: eq });

describe('party pack (shared bag)', () => {
  it('adds up the members bags and carry limits', () => {
    const ms = [member({}), member({ bag: 'x_bag_1' }), member({ chest: 'x_chest_2' })];
    const p = partyPack(ms, [], null);
    expect(bagSlots(p)).toBe(6 + 10 + 6);
    expect(carryLimit(p)).toBe(15 + 30 + 15);
  });

  it('counts worn gear toward the party weight, so heavy armour slows everyone', () => {
    const light = partyPack([member({}), member({})], [], null);
    const plate = partyPack([member({ chest: 'x_chest_3' }), member({ chest: 'x_chest_3' })], [], null);
    expect(totalWeight(plate)).toBe(2 * xitem('x_chest_3').weight);
    let heavy = plate;
    for (const id of ['x_crown', 'x_tome']) heavy = addItem(heavy, id).loadout;
    expect(speedMult(heavy)).toBeLessThan(speedMult(light));
  });

  it('a member lost shrinks the pack and the overflow spills, nothing vanishes', () => {
    const ms = [member({ bag: 'x_bag_1' }), member({ bag: 'x_bag_1' })];
    let p = partyPack(ms, [], null);
    for (let i = 0; i < 16; i++) p = addItem(p, 'x_spoon', 5).loadout;
    const before = p.bag.reduce((a, s) => a + s.n, 0);
    const shrunk = settleCapacity(partyPack(ms.slice(0, 1), p.bag, null));
    expect(shrunk.loadout.bag.length).toBeLessThanOrEqual(10);
    expect(shrunk.loadout.bag.reduce((a, s) => a + s.n, 0) + shrunk.dropped.reduce((a, s) => a + s.n, 0)).toBe(before);
  });

  it('without overrides a loadout behaves exactly as before', () => {
    const l = member({ bag: 'x_bag_2', chest: 'x_chest_1' });
    expect([bagSlots(l), carryLimit(l), totalWeight(l)]).toEqual([14, 40, xitem('x_bag_2').weight + xitem('x_chest_1').weight]);
  });
});
