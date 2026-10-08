import { expect, it } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { rollEquipment } from '../../../src/sim/grid/items';
import { fromSave, toSave } from '../../../src/sim/grid/save';
import { OPEN, sim } from './kit';
it('loot never yields removed weapons across seeds', () => {
  const groups = new Set<string>();
  for (let seed = 0; seed < 100; seed++) for (let floor = 1; floor <= 15; floor++) groups.add(rollEquipment(createRng(seed * 31 + floor), floor).group);
  expect([...groups].sort()).toEqual(['axe', 'bow', 'dagger', 'mace', 'spear', 'staff', 'sword']);
});
it('migrates both hands, bag and floor weapons and drops unknown engraving ids', () => {
  const data = JSON.parse(toSave(sim(OPEN, { x: 3, y: 7 }).s));
  const weapon = (group: string) => ({ kind: 'weapon', group, tier: 2, name: 'old' });
  data.state.hero.gear.hands = [weapon('rifle'), weapon('staff')];
  data.state.hero.gear.bag = [weapon('staff'), weapon('shotgun')];
  data.state.floorItems = [{ pos: { x: 4, y: 7 }, item: weapon('staff') }];
  data.state.hero.suit = ['dash', 'removed']; data.state.offers = [['removed', 'echo']];
  delete data.state.hero.rounds; delete data.state.hero.roundIdx;
  const s = fromSave(JSON.stringify(data));
  expect(s.hero.gear.hands[0]).toMatchObject({ group: 'bow', tier: 1, name: '사냥 활' });
  expect(s.hero.gear.hands[1]?.group).toBe('staff'); expect(s.hero.gear.bag).toHaveLength(2);
  expect(s.hero.gear.bag[1]).toMatchObject({ group: 'bow' }); expect(s.floorItems[0]?.item).toMatchObject({ group: 'staff' });
  expect(s.hero.suit).toEqual(['dash']); expect(s.offers).toEqual([['echo']]); expect(s.hero.rounds).toEqual([]); expect(s.hero.roundIdx).toBe(0);
});
