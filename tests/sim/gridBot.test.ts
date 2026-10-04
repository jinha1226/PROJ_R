import { expect, it } from 'vitest';
import { GRID_BOT_CAP, gridBotAction, playGridRun } from './support/gridBot';
import { makeWeapon } from '../../src/sim/grid/items';
import { OPEN, sim } from './grid/kit';

it.each(['decent', 'pistol-only'] as const)('%s finishes a deterministic bounded run', mode => {
  const a = playGridRun(7, mode);
  expect(a.outcome).not.toBe('cap');
  expect(a.actions).toBeLessThan(GRID_BOT_CAP);
  expect(a).toEqual(playGridRun(7, mode));
}, 60_000);

it('takes first choices, heals below 40%, equips the empty hand and switches for melee', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 6, y: 7 } }]);
  s.hero.gear.hands[1] = null;
  s.upgrades = [['charge']]; s.offers = [['dash']];
  expect(gridBotAction(s, 'decent')).toEqual({ kind: 'upgrade', i: 0 });
  s.upgrades = [];
  expect(gridBotAction(s, 'decent')).toEqual({ kind: 'choose', i: 0, slot: 0 });
  s.offers = []; s.hero.hp = 1;
  expect(gridBotAction(s, 'decent')).toEqual({ kind: 'use', item: 'potion' });
  s.hero.hp = s.hero.maxHp; s.hero.gear.bag.push(makeWeapon('sword', 1));
  expect(gridBotAction(s, 'decent')).toEqual({ kind: 'swap' });
  s.hero.gear.active = 1;
  expect(gridBotAction(s, 'decent')).toEqual({ kind: 'equip', bag: 0 });
  s.hero.gear.hands[1] = makeWeapon('sword', 1); s.hero.gear.active = 0;
  expect(gridBotAction(s, 'decent')).toEqual({ kind: 'swap' });
  expect(gridBotAction(s, 'pistol-only').kind).toBe('move');
});

it('shoots only awake visible foes in range with charge', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 9, y: 7 } }]);
  expect(gridBotAction(s, 'decent')).toEqual({ kind: 'shoot', target: 'f1' });
  s.hero.charge = 0;
  expect(gridBotAction(s, 'decent').kind).not.toBe('shoot');
  s.hero.charge = 10; s.foes[0]!.awake = false;
  expect(gridBotAction(s, 'decent').kind).not.toBe('shoot');
});

it('pistol-only routes around melee pickups without opening chests', () => {
  const g = sim(OPEN, { x: 5, y: 7 });
  g.s.seen.fill(1);
  g.s.map.stairs = { x: 9, y: 7 };
  g.s.floorItems = [{ pos: { x: 6, y: 7 }, item: makeWeapon('sword', 1) }];
  for (let i = 0; i < 4; i++) g.act(gridBotAction(g.s, 'pistol-only'));
  expect(g.s.hero.gear.bag).toEqual([]);
  expect(g.s.hero.gear.hands[1]).toMatchObject({ group: 'dagger', name: '요원 칼' });
});

it('descends onto a boss echo once the floor is explored', () => {
  const g = sim(OPEN, { x: 5, y: 7 });
  g.s.seen.fill(1);
  g.s.map.stairs = { x: 7, y: 7 };
  g.s.floorItems = [{ pos: { x: 7, y: 7 }, item: { kind: 'echo', family: 'all', name: '잔향' } }];
  for (let i = 0; i < 2; i++) g.act(gridBotAction(g.s, 'decent'));
  expect(g.s.run.floor).toBe(2);
});

it('revisits enemies on explored ground instead of waiting forever', () => {
  const { s } = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'champion', pos: { x: 12, y: 7 } }]);
  s.seen.fill(1); s.visible.clear();
  expect(gridBotAction(s, 'decent').kind).toBe('move');
});
