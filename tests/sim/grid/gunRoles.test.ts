import { describe, expect, it } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { rangedAttack } from '../../../src/sim/grid/weapons';
import { OPEN, sim, sureHits } from './kit';

const hooks = { noise: () => {} };
const shooter = (group: 'bow', foeX: number) => {
  const g = sim(OPEN, { x: 2, y: 5 }, [{ kind: 'brute', pos: { x: foeX, y: 5 }, awake: true }]);
  g.s.hero.gear.hands[0] = makeWeapon(group, 1);
  g.s.foes[0]!.hp = g.s.foes[0]!.maxHp = 500;
  sureHits(g);
  g.s.rng.int = (lo: number) => lo;
  return g;
};

describe('bow', () => {
  it('the pistol costs one charge and 0.6 turns', () => {
    const g = shooter('bow', 5);
    expect(rangedAttack(g.s, 0, g.s.foes[0]!, hooks)).toBeCloseTo(1);
    expect(g.s.hero.arrows).toBe(23);
  });



});
