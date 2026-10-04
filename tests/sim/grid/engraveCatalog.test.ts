import { expect, it } from 'vitest';
import { BASE_IDS, ENGRAVES, fitsHand } from '../../../src/sim/grid/engraveCore';
import { makeWeapon, type WeaponGroup } from '../../../src/sim/grid/items';
import { OPEN, sim } from './kit';

it.each([
  ['pistol', 'dagger', true], ['pistol', null, false],
  ['dagger', 'sword', false], ['pistol', 'rifle', false],
] as const)('kata fits %s / %s in either active hand', (a, b, expected) => {
  const s = sim(OPEN, { x: 3, y: 3 }).s;
  s.hero.gear.hands = [makeWeapon(a as WeaponGroup, 1), b ? makeWeapon(b, 1) : null];
  for (const active of [0, 1] as const) {
    s.hero.gear.active = active;
    for (const id of ['gunRelay', 'bladeRelay', 'spinShot'] as const) expect(fitsHand(s, id)).toBe(expected);
  }
});
it('prices precisely the twelve base engravings; others remain run-only', () => {
  const costs = { gunRelay: 60, bladeRelay: 60, spinShot: 90, counterShot: 70, execute: 90, flow: 120,
    shoveShot: 50, dash: 50, riposte: 70, counter: 60, momentum: 80, quickswap: 60 };
  expect([...BASE_IDS].sort()).toEqual(Object.keys(costs).sort());
  for (const [id, entry] of Object.entries(ENGRAVES)) {
    expect(entry.base).toBe(id in costs);
    expect(entry.cost).toBe(costs[id as keyof typeof costs] ?? 0);
  }
});
