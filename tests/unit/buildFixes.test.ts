import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { implant, living } from '../../src/sim/roam/roam';
const setup = () => { const p = newDelve(2), u = living(p)[0]!; implant(p, u, 'warrior', []); return { p, u }; };
import { roomStep } from '../../src/sim/delve/delveRooms';
import { entOf } from '../../src/sim/party/partyCore';
import { rollItem } from '../../src/sim/delve/items';
import { createRng } from '../../src/core/rng';

it.each([6, 10, 20])('floor %i chest and elite loot return gear', floor => {
  const { p, u } = setup(); p.floor = floor; p.pack = []; p.combat = false;
  p.chests = [{ pos: { ...entOf(p, u.id)!.pos }, tier: 2, opened: false }];
  roomStep(p, new Map(), []); expect(p.pack.some(i => 'def' in i)).toBe(true);
  const foe = p.units.find(x => x.side === 'foe')!, e = entOf(p, foe.id)!;
  e.alive = false; e.elite = true; p.s.rng.chance = () => true;
  roomStep(p, new Map(), []); expect(p.floorItems.some(i => 'def' in i.item)).toBe(true);
});
it('empty floor filters fall back to the closest available tier', () => {
  expect(rollItem(createRng(1), -10, 'armor', 3)).toHaveProperty('def');
});
