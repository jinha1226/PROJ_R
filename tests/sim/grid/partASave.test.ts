import { expect, it } from 'vitest';
import { fromSave, toSave } from '../../../src/sim/grid/save';
import { OPEN, sim } from './kit';

it.each([['magic', 'element'], ['any', 'fusion'], ['all', 'fusion']] as const)('converts old %s echo families', (before, after) => {
  const { s } = sim(OPEN, { x: 5, y: 7 });
  const data = JSON.parse(toSave(s));
  data.state.floorItems.push({ pos: { x: 6, y: 7 }, item: { kind: 'echo', family: before, name: '잔향' } });
  expect(fromSave(JSON.stringify(data)).floorItems[0]?.item).toMatchObject({ family: after });
});
it('old heroes default to no shield and saved shields persist', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 }); delete s.hero.shield;
  expect(fromSave(toSave(s)).hero.shield).toBe(0);
  s.hero.shield = 3; expect(fromSave(toSave(s)).hero.shield).toBe(3);
});
