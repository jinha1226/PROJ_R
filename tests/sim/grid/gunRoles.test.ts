import { describe, expect, it } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { rangedAttack } from '../../../src/sim/grid/weapons';
import { OPEN, sim, sureHits } from './kit';

const hooks = { noise: () => {} };
const shooter = (group: 'pistol', foeX: number) => {
  const g = sim(OPEN, { x: 2, y: 5 }, [{ kind: 'brute', pos: { x: foeX, y: 5 }, awake: true }]);
  g.s.hero.gear.hands[0] = makeWeapon(group, 1);
  g.s.foes[0]!.hp = g.s.foes[0]!.maxHp = 500;
  sureHits(g);
  g.s.rng.int = (lo: number) => lo;
  return g;
};

describe('pistol', () => {
  it('the pistol costs one charge and 0.6 turns', () => {
    const g = shooter('pistol', 5);
    expect(rangedAttack(g.s, 0, g.s.foes[0]!, hooks)).toBeCloseTo(0.6);
    expect(g.s.hero.charge).toBe(g.s.hero.maxCharge - 1);
  });



});
