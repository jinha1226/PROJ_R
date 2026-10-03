import { describe, it, expect } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { applyElement } from '../../../src/sim/grid/status';
import { evasionOf, parryOf } from '../../../src/sim/grid/defense';
import type { GridSim } from '../../../src/sim/grid/gridSim';
import { OPEN, sim } from './kit';

/** Rolls succeed only for chances at or above `bar` (and damage rolls take the minimum). */
const rolls = (g: GridSim, bar: number) => {
  g.s.rng = { next: () => 0, int: (a: number) => a, chance: (p: number) => p >= bar, pick: <T>(arr: readonly T[]) => arr[0]!, shuffle: <T>(arr: T[]) => arr, getState: () => 0 };
};
const W = { kind: 'wait' } as const;

describe('dodge and parry', () => {
  it('evasion: 5% base, more with a dagger in hand and light or no armour', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    g.s.hero.gear.armor = { kind: 'armor', tier: 3, name: '판금 갑옷', reduce: 3 };
    expect(evasionOf(g.s)).toBeCloseTo(0.05);
    g.s.hero.gear.armor = null;
    g.s.hero.gear.hands[0] = makeWeapon('dagger', 1);
    expect(evasionOf(g.s)).toBeCloseTo(0.2);
  });

  it('a dodged blow does no harm and says which way the hero weaved', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'minion', pos: { x: 8, y: 7 } }]);
    g.s.hero.gear.armor = null;
    g.s.hero.gear.hands[0] = makeWeapon('dagger', 1);
    rolls(g, 0.15);
    const hp = g.s.hero.hp;
    const ev = g.act(W);
    const d = ev.find((e) => e.type === 'dodge');
    expect(d?.text === 'L' || d?.text === 'R').toBe(true);
    expect(g.s.hero.hp).toBe(hp);
  });

  it('a sword in hand parries melee but not arrows', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'minion', pos: { x: 8, y: 7 } }]);
    g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    expect(parryOf(g.s)).toBeCloseTo(0.12);
    rolls(g, 0.11);
    expect(g.act(W).some((e) => e.type === 'parry')).toBe(true);
    const a = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'archer', pos: { x: 8, y: 7 } }]);
    a.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    a.s.hero.gear.armor = { kind: 'armor', tier: 3, name: '판금 갑옷', reduce: 3 };
    rolls(a, 0.11);
    expect(a.act(W).some((e) => e.type === 'parry')).toBe(false);
  });

  it('elements and blasts are never dodged or parried', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    rolls(g, 0);
    applyElement(g.s, 0, 'fire', g.s.hero.pos, 0, [3, 3], 'f9');
    expect(g.s.events.some((e) => e.type === 'dodge' || e.type === 'parry')).toBe(false);
    expect(g.s.hero.hp).toBe(g.s.hero.maxHp - 3);
  });
});
