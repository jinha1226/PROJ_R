import { describe, expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { floorPower, partyPower, unitPower } from '../../src/sim/base/power';
import { starterGear } from '../../src/sim/delve/gear';

describe('base power', () => {
  it('rates shells near ten and grows with level, gear, traits and promotion', () => {
    const p = newSurface(1), u = p.units[0]!;
    expect(unitPower(p, u)).toBe(10);
    u.level = 8;
    const plain = unitPower(p, u);
    u.cls = 'guardian'; u.gear = starterGear('guardian', () => 'gear');
    u.traits = { toughness: 3, seasoned: 2 };
    expect(unitPower(p, u)).toBeGreaterThan(plain);
    expect(unitPower(p, u)).toBeGreaterThanOrEqual(60);
    expect(unitPower(p, u)).toBeLessThanOrEqual(80);
    const promoted = unitPower(p, u); u.cls = 'warrior';
    expect(unitPower(p, u)).toBeLessThan(promoted);
  });
  it('ignores dead clones and recommends monotonically harder floors', () => {
    const p = newSurface();
    expect(partyPower(p)).toBe(10);
    p.s.hero.alive = false;
    expect(partyPower(p)).toBe(0);
    for (let f = 1; f < 15; f++) expect(floorPower(f + 1)).toBeGreaterThan(floorPower(f));
    expect([1, 5, 10].map(floorPower)).toEqual([15, 60, 140]);
  });
});
