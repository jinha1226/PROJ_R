import { describe, expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { canUpgradeDrill, drillCost, startFloors, upgradeDrill, startDelve } from '../../src/sim/base/drill';
import type { GEvent } from '../../src/sim/grid/types';
import { takeParty } from '../../src/sim/roam/carry';

describe('drill', () => {
  it('opens floors and spends exactly the next level cost', () => {
    const p = newSurface(); p.ore = 190; p.crystal = 20;
    expect(p.drillLevel).toBe(0); expect(startFloors(p)).toEqual([1]);
    expect([1, 2, 3].map(drillCost)).toEqual([{ ore: 30, crystal: 0 }, { ore: 60, crystal: 5 }, { ore: 100, crystal: 15 }]);
    for (const floors of [[1, 3], [1, 3, 5], [1, 3, 5, 8]]) {
      const ev: GEvent[] = []; expect(upgradeDrill(p, ev)).toBe(true);
      expect(ev).toMatchObject([{ type: 'buff', text: 'drill' }]); expect(startFloors(p)).toEqual(floors);
    }
    expect([p.ore, p.crystal]).toEqual([0, 0]); expect(canUpgradeDrill(p)).toBe(false);
    expect(upgradeDrill(p)).toBe(false);
  });
  it('refuses insufficient resources and locked depths without mutation', () => {
    const p = newSurface(); p.ore = 29;
    expect(upgradeDrill(p)).toBe(false); expect(p.ore).toBe(29);
    expect(startDelve(p, 2, takeParty(p), 3)).toBeNull();
    p.ore = 30; upgradeDrill(p);
    expect(startDelve(p, 2, takeParty(p), 3)?.floor).toBe(3);
    expect(startDelve(p, 2, takeParty(p))?.floor).toBe(1);
  });
});
