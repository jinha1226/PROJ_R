import { describe, expect, it } from 'vitest';
import { FIRST_WAVE } from '../../src/sim/base/siege';
import { newSurface, worldTick, canDrill } from '../../src/sim/overworld/worldSim';
import { departSurface, returnToSurface } from '../../src/sim/base/trips';
import { upgradeDrill } from '../../src/sim/base/drill';
import { takeClone, takeParty } from '../../src/sim/roam/carry';

describe('base trips', () => {
  it('preserves base state, suspends surface ticks, and brings back the depth reached and what was carried', () => {
    const p = newSurface(7); p.ore = 200; p.bio = 10;
    upgradeDrill(p);
    const claimed = [...p.claimed], siege = structuredClone(p.siege);
    const delve = departSurface(p, 9, takeClone(p, 'hero'), 3)!;
    expect(delve.floor).toBe(3); expect(p.away).toBe(true);
    expect(departSurface(p, 10, takeParty(p))).toBeNull();
    expect(worldTick(p, 100)).toEqual([]);
    delve.s.hero.hp = 1; delve.ore += 11;
    const back = takeParty(delve); expect(back.deepest).toBe(3);
    returnToSurface(p, back);
    expect(p.away).toBe(false); expect(p.trips).toBe(1); expect(p.deepest).toBe(3);
    expect(p.ore).toBe(181);
    expect([...p.claimed]).toEqual(claimed); expect(p.drillLevel).toBe(1); expect(p.siege).toEqual({ ...siege, phase: 'gap', nextAt: p.time + FIRST_WAVE });
    // another may go at once: nothing keeps the party home
    expect(canDrill(p, 'hero')).toBe(true);
    const next = departSurface(p, 10, takeClone(p, 'hero'))!;
    next.deepest = 8; returnToSurface(p, takeParty(next));
    expect(p.deepest).toBe(8); expect(p.trips).toBe(2);
  });
});
