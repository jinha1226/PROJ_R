import { describe, expect, it } from 'vitest';
import { makeWeapon, WEAPONS } from '../../../src/sim/grid/items';
import { rangedAttack } from '../../../src/sim/grid/weapons';
import { OPEN, sim, sureHits } from './kit';

const hooks = { noise: () => {}, cast: () => 1 };
const shooter = (group: 'pistol' | 'shotgun' | 'rifle', foeX: number) => {
  const g = sim(OPEN, { x: 2, y: 5 }, [{ kind: 'brute', pos: { x: foeX, y: 5 }, awake: true }]);
  g.s.hero.gear.hands[0] = makeWeapon(group, 1);
  g.s.foes[0]!.hp = g.s.foes[0]!.maxHp = 500;
  sureHits(g);
  g.s.rng.int = (lo: number) => lo;
  return g;
};

describe('each gun plays differently', () => {
  it('the pistol is the quick one: cheapest and fastest shot', () => {
    expect(WEAPONS.pistol.time).toBeLessThan(WEAPONS.shotgun.time);
    expect(WEAPONS.pistol.time).toBeLessThan(WEAPONS.rifle.time);
    const g = shooter('pistol', 5);
    expect(rangedAttack(g.s, 0, g.s.foes[0]!, hooks)).toBeCloseTo(0.6);
    expect(g.s.hero.charge).toBe(g.s.hero.maxCharge - 1);
  });

  it('the rifle fires a three-round burst, each bullet rolled on its own', () => {
    const g = shooter('rifle', 7);
    const rolls = [true, false, true];
    g.s.rng.chance = () => rolls.shift()!;
    rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
    expect(rolls).toEqual([]);
    expect(g.s.events.filter((e) => e.type === 'shoot')).toHaveLength(3);
    expect(g.s.events.filter((e) => e.type === 'hit' && e.dst === 'f1')).toHaveLength(2);
    expect(g.s.events.filter((e) => e.type === 'miss')).toHaveLength(1);
    expect(g.s.hero.charge).toBe(g.s.hero.maxCharge - 2);
  });

  it('the burst stops once the target falls', () => {
    const g = shooter('rifle', 7);
    g.s.foes[0]!.hp = 1;
    rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
    expect(g.s.events.filter((e) => e.type === 'shoot')).toHaveLength(1);
  });

  it('the shotgun hits hardest point-blank and weakest at the edge of its reach', () => {
    const taken = (x: number) => { const g = shooter('shotgun', x); rangedAttack(g.s, 0, g.s.foes[0]!, hooks); return 500 - g.s.foes[0]!.hp; };
    const lo = WEAPONS.shotgun.dmg[0][0];
    expect(taken(3)).toBe(Math.round(lo * 1.5));
    expect(taken(4)).toBe(lo);
    expect(taken(5)).toBe(Math.round(lo * 0.6));
  });
});
