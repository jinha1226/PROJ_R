import { expect, it } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { scatterLoot } from '../../../src/sim/grid/consumables';
import { placeTraps } from '../../../src/sim/grid/traps';
import { OPEN, sim } from './kit';

it.each([[1, 4, 2], [5, 6, 2], [6, 6, 3], [10, 8, 3], [11, 9, 4], [15, 9, 4]])('floor %s has %s traps and %s consumables', (floor, traps, loot) => {
  const s = sim(OPEN, { x: 1, y: 1 }).s;
  s.run.floor = floor;
  s.map.rooms = [{ x: 1, y: 1, w: 2, h: 2 }, { x: 5, y: 5, w: 7, h: 7 }];
  expect.soft(placeTraps(s.map, new Set(), createRng(3), floor)).toHaveLength(traps);
  expect(scatterLoot(s).filter(f => f.item.kind !== 'material')).toHaveLength(loot);
  expect(scatterLoot(s)).toEqual(scatterLoot(s));
});
