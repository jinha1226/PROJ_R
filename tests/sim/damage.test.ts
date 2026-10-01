import { describe, it, expect } from 'vitest';
import { computeDamage, dealDamage, heal } from '../../src/sim/battle/damage';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';

const duel = () => {
  const s = createState(setupFromPresets(5, 'solo', 'tutorial'));
  return { s, a: s.units[0]!, e: s.units[1]! };
};
const hit = (mult: number) => ({ mult, canDodge: false, canCrit: false, skillId: 't' });

describe('damage', () => {
  it('follows the formula with floor of 1', () => {
    expect(computeDamage(20, 1, 100, false, 1)).toBe(10);
    expect(computeDamage(20, 1, 0, true, 1)).toBe(30);
    expect(computeDamage(1, 0.1, 500, false, 1)).toBe(1);
  });
  it('kills enemies outright and downs allies', () => {
    const { s, a, e } = duel();
    e.hp = 1;
    dealDamage(s, a, e, hit(10));
    expect(e.alive).toBe(false);
    expect(a.stats.kills).toBe(1);
    expect(s.events.some((x) => x.type === 'died')).toBe(true);
    a.hp = 1;
    dealDamage(s, s.units[2]!, a, hit(10));
    expect(a.alive).toBe(true);
    expect(a.downed).toBe(true);
    expect(a.lifeline).toBe(a.maxHp * 0.5);
  });
  it('drains lifeline when downed and then dies', () => {
    const { s, a, e } = duel();
    a.hp = 1;
    dealDamage(s, e, a, hit(10));
    for (let i = 0; i < 50 && a.alive; i++) dealDamage(s, e, a, hit(5));
    expect(a.alive).toBe(false);
    expect(a.downed).toBe(false);
  });
  it('shield absorbs first, momentum grows, threat accrues', () => {
    const { s, a, e } = duel();
    a.shield = 1000;
    const hp = a.hp;
    dealDamage(s, e, a, hit(1));
    expect(a.hp).toBe(hp);
    expect(a.shield).toBeLessThan(1000);
    expect(a.momentum).toBeGreaterThan(0);
    expect(e.momentum).toBeGreaterThan(0);
    expect(a.threat[e.id]).toBeGreaterThan(0);
  });
  it('dodge produces a miss and no damage', () => {
    const { s, a, e } = duel();
    a.setup.stats.dodge = 0.5;
    let misses = 0;
    for (let i = 0; i < 40; i++) if (dealDamage(s, e, a, { ...hit(0.01), canDodge: true }) === 0) misses++;
    expect(misses).toBeGreaterThan(5);
    expect(a.stats.dodges).toBe(misses);
  });
  it('heal caps at maxHp and ignores downed', () => {
    const { s, a } = duel();
    a.hp = a.maxHp - 5;
    expect(heal(s, a, a, 100, 'heal')).toBe(5);
    a.downed = true;
    expect(heal(s, a, a, 100, 'heal')).toBe(0);
  });
});
