import { makeWeapon, type WeaponGroup } from '../../../src/sim/grid/items';
import { expect, it } from 'vitest';
import { BASE_IDS, ENGRAVES, ENGRAVE_IDS, fitsHand } from '../../../src/sim/grid/engraveCore';
import { absorbOffer, FAMILY } from '../../../src/sim/grid/absorb';
import { OPEN, sim } from './kit';

it('every engraving has a family, tags and a positive unlock cost', () => {
  for (const def of Object.values(ENGRAVES)) {
    expect(['melee', 'ranged', 'fusion', 'element']).toContain(def.family);
    expect(def.tags.length).toBeGreaterThan(0);
    expect(def.cost).toBeGreaterThan(0);
    expect(def.base).toBe(true);
  }
  expect(BASE_IDS).toEqual(ENGRAVE_IDS);
});
it('archer echoes offer only ranged engravings, reserving a locked choice first', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 }); s.hero.suit = ['rapid'];
  s.run.unlocked = ENGRAVE_IDS.filter(id => id !== 'volley');
  const offer = absorbOffer(s, FAMILY.archer);
  expect(offer).toHaveLength(3); expect(offer[0]).toBe('volley');
  expect(offer.every(id => typeof id === 'object' || (ENGRAVES[id].family === 'ranged' && id !== 'rapid'))).toBe(true);
});

it.each([
  ['pistol', 'dagger', true], ['pistol', null, false],
  ['dagger', 'sword', false], ['pistol', 'pistol', false],
] as const)('kata fits %s / %s in either active hand', (a, b, expected) => {
  const s = sim(OPEN, { x: 3, y: 3 }).s;
  s.hero.gear.hands = [makeWeapon(a as WeaponGroup, 1), b ? makeWeapon(b, 1) : null];
  for (const active of [0, 1] as const) {
    s.hero.gear.active = active;
    for (const id of ['gunRelay', 'bladeRelay', 'spinShot'] as const) expect(fitsHand(s, id)).toBe(expected);
  }
});

it('uses exactly the planned unlock costs', () => {
  const costs = { dash: 50, finisher: 40, leap: 60, counter: 60, riposte: 70, wallslam: 50, laststand: 50,
    rapid: 50, mark: 60, ricochet: 60, kite: 40, volley: 70, gunRelay: 60, bladeRelay: 60, spinShot: 90,
    counterShot: 70, execute: 90, flow: 120, shoveShot: 50, quickswap: 60, swapstrike: 50, momentum: 80,
    alternate: 60, echo: 60, chain: 60, elemArrow: 60,
    bloodlust: 50, fury: 60, shoulder: 50, ironwall: 60, cull: 90, tempest: 90, gale: 100, rebound: 50,
    quickdraw: 50, pierce: 70, sniper: 60, headshot: 80, covering: 70, suppress: 60, barrage: 120, thrift: 60, steady: 50,
    bayonet: 70, reverseCut: 70, reclaim: 40, muzzleShove: 40, executionRush: 60, trance: 80,
    fireSpread: 70, fireBlade: 60, fireStoke: 50, fireEmber: 50,
    frostShatter: 90, frostVeil: 60, frostBite: 50, frostSnap: 90,
    shockArc: 70, shockCharge: 60, shockCut: 60, shockDischarge: 80,
    poisonBurst: 70, poisonVenom: 60, poisonParalyze: 70, poisonSiphon: 60 };
  expect(Object.fromEntries(ENGRAVE_IDS.map(id => [id, ENGRAVES[id].cost]))).toEqual(costs);
});
