import { describe, expect, it } from 'vitest';
import { newSurface, worldTick, canDrill } from '../../src/sim/overworld/worldSim';
import { departSurface, returnToSurface } from '../../src/sim/base/trips';
import { upgradeDrill } from '../../src/sim/base/drill';
import { place } from '../../src/sim/base/buildings';
import { takeClone, takeParty } from '../../src/sim/roam/carry';
import { startRaid } from '../../src/sim/base/raids';

describe('base trips', () => {
  it('preserves base state, suspends surface ticks, returns depth before the raid', () => {
    const p = newSurface(7); p.ore = 200; p.bio = 10;
    upgradeDrill(p); place(p, { x: 44, y: 44 });
    p.podHp = 150;
    const before = structuredClone(p.buildings), claimed = [...p.claimed];
    const delve = departSurface(p, 9, takeClone(p, 'hero'), 3)!;
    expect(delve.floor).toBe(3); expect(p.away).toBe(true);
    expect(departSurface(p, 10, takeParty(p))).toBeNull();
    expect(worldTick(p, 100)).toEqual([]); expect(startRaid(p)).toEqual([]);
    delve.s.hero.hp = 1; delve.ore += 11;
    const back = takeParty(delve); expect(back.deepest).toBe(3);
    expect(returnToSurface(p, back)).toMatchObject([{ text: 'raidSoon' }]);
    expect(p.away).toBe(false); expect(p.trips).toBe(1); expect(p.deepest).toBe(3);
    expect(p.ore).toBe(181);
    expect(p.buildings).toEqual(before); expect([...p.claimed]).toEqual(claimed);
    expect([p.drillLevel, p.podHp, p.raidsDone]).toEqual([1, 150, 0]);
    const next = departSurface(p, 10, takeClone(p, 'hero'))!;
    next.deepest = 8; const ev = returnToSurface(p, takeParty(next));
    // the raid night waits at the pod until the player starts it, and nobody may leave meanwhile
    expect(ev.some(e => e.text === 'raidReady')).toBe(true); expect(p.raidReady).not.toBeNull(); expect(p.deepest).toBe(8);
    expect(departSurface(p, 11, takeParty(p))).toBeNull(); expect(canDrill(p)).toBe(false);
    expect(startRaid(p).some(e => e.type === 'summon')).toBe(true); expect(p.raid).not.toBeNull();
  });
  it('a wiped carry still starts and resolves the scheduled raid', () => {
    const p = newSurface(); p.ore = 30; upgradeDrill(p);
    returnToSurface(p, takeParty(p));
    const d = departSurface(p, 4, takeClone(p, 'hero'))!; d.s.hero.alive = false;
    returnToSurface(p, takeParty(d)); expect(p.raidReady).not.toBeNull();
    startRaid(p); expect(p.raid).not.toBeNull();
    p.podHp = 0; expect(worldTick(p, 1).some(e => e.text === 'raidLost')).toBe(true);
    expect(p.raid).toBeNull(); expect(p.podHp).toBe(150);
  });
});
