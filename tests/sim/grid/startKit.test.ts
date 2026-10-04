import { expect, it } from 'vitest';
import { newRunState } from '../../../src/sim/grid/runSetup';
import { freshMeta } from '../../../src/sim/grid/meta';
import { newState } from '../../../src/sim/grid/state';
import { generateMap } from '../../../src/sim/grid/mapgen';
import { scatterLoot } from '../../../src/sim/grid/consumables';

it.each([1, 6, 11] as const)('starts floor %i with the chosen gun and agent knife', start => {
  for (const gun of ['pistol'] as const) {
    const s = newRunState(7, freshMeta(), { gun, start, startSuit: [] });
    expect(s.hero.gear.active).toBe(0);
    expect(s.hero.gear.hands[0]).toMatchObject({ group: gun, tier: 1 });
    expect(s.hero.gear.hands[1]).toMatchObject({ group: 'dagger', tier: 1, name: '요원 칼' });
  }
});
it('leaves floor-one loot exactly as scatterLoot generated it', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const expected = newState(generateMap(seed, 1), seed, 'pistol', 1);
    expected.floorItems.push(...scatterLoot(expected));
    const actual = newRunState(seed, freshMeta(), { gun: 'pistol', start: 1, startSuit: [] });
    expect(actual.floorItems).toEqual(expected.floorItems);
  }
});
