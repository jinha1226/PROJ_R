import { describe, expect, it } from 'vitest';
import { buy, energyFor, freshMeta, SHOP, settleRun } from '../../../src/sim/grid/meta';
import { newRunState } from '../../../src/sim/grid/runSetup';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { settleKills, XP_STEPS } from '../../../src/sim/grid/run';
import { HERO } from '../../../src/sim/grid/types';

describe('meta energy and facilities', () => {
  it('rounds scaled normal and elite energy, with fixed boss awards', () => {
    expect(['minion', 'ghoul', 'archer', 'brute', 'mage'].map(k => energyFor(k as 'minion', 1, false))).toEqual([2, 3, 3, 4, 4]);
    expect(energyFor('ghoul', 6, false)).toBe(5);
    expect(energyFor('minion', 2, true)).toBe(7);
    expect([5, 10, 15].map(f => energyFor('champion', f, true))).toEqual([60, 60, 150]);
  });
  it('has independent defaults and purchases every upgrade once with prerequisites', () => {
    const m = freshMeta();
    expect(m.records).toEqual(['dash', 'rapid', 'chain', 'momentum']);
    expect(m.rounds).toEqual([]);
    expect(buy(m, 'round:fire')).toBe(false);
    m.energy = 2000;
    expect(buy(m, 'missing')).toBe(false);
    expect(buy(m, 'suitSlots4')).toBe(false);
    expect(buy(m, 'chargePlus2')).toBe(false);
    expect(buy(m, 'navCrypt')).toBe(false);
    expect(buy(m, 'navRuins')).toBe(false);
    m.bossesKilled = [5, 10];
    for (const entry of SHOP) {
      const before = m.energy;
      expect(buy(m, entry.id)).toBe(true);
      expect(m.energy).toBe(before - entry.cost);
      expect(buy(m, entry.id)).toBe(false);
    }
    expect(m.rounds).toEqual(['fire', 'frost', 'shock', 'poison']);
    expect(freshMeta().facilities.suitSlots).toBe(2);
  });
  it.each([1, 6, 11] as const)('sets up floor %i with level HP, charge, gear and copied records', start => {
    const m = freshMeta();
    Object.assign(m.facilities, { suitSlots: 2, chargePlus: 2, navCrypt: true, navRuins: true });
    m.unlocked = ['dash', 'rapid', 'chain'];
    const s = newRunState(12, m, { gun: 'pistol', start, startSuit: m.unlocked });
    const level = start === 1 ? 1 : start === 6 ? 4 : 7;
    expect(s.run.floor).toBe(start);
    expect(s.hero.level).toBe(level);
    expect(s.hero.xp).toBe(level === 1 ? 0 : XP_STEPS[level - 2]);
    expect(s.hero.maxHp).toBe(HERO.hp + (level - 1) * 5);
    expect(s.hero.hp).toBe(s.hero.maxHp);
    expect(s.hero.maxCharge).toBe(14);
    expect(s.hero.charge).toBe(14);
    expect(s.hero.suit).toEqual(start === 1 ? ['dash', 'rapid'] : []);
    expect(s.hero.gear.hands[0]?.group).toBe('pistol');
    expect(s.upgrades).toEqual([]);
    s.records.push('finisher');
    expect(m.records).not.toContain('finisher');
  });
  it('createRun wraps setup; kills grant energy once and record boss floors', () => {
    const s = GridSim.createRun(3, freshMeta(), { gun: 'pistol', start: 1, startSuit: [] }).s;
    const f = s.foes[0]!;
    f.alive = false;
    const alive = new Set([f.id]);
    settleKills(s, alive);
    expect(s.run.energy).toBe(energyFor(f.kind as 'minion', 1, !!f.elite));
    expect(s.events).toContainEqual({ t: 0, type: 'energy', amount: s.run.energy, to: f.pos });
    settleKills(s, alive);
    const energy = s.run.energy;
    f.kind = 'champion'; s.run.floor = 5;
    settleKills(s, new Set([f.id]));
    expect(s.run.energy).toBe(energy + 60);
    expect(s.run.bossesKilled).toEqual([5]);
  });
  it.each(['dead', 'won'] as const)('settles %s energy, records, statistics and death suit', outcome => {
    const m = freshMeta(); m.energy = 10; m.best = 6; m.bossesKilled = [5];
    const s = GridSim.create(3).s;
    Object.assign(s.run, { energy: 25, floor: 10, bossesKilled: [5, 10], killedBy: { kind: 'mage', elite: true } });
    s.records.push('finisher'); s.hero.suit = ['dash']; s.outcome = outcome;
    const result = settleRun(m, s);
    expect(result.energy).toBe(35);
    expect(result.records).toContain('finisher');
    expect(new Set(result.records).size).toBe(result.records.length);
    expect(result.best).toBe(10);
    expect(result.wins).toBe(outcome === 'won' ? 1 : 0);
    expect(result.bossesKilled).toEqual([5, 10]);
    expect(result.suit).toEqual(outcome === 'dead' ? { floor: 10, ids: ['dash'], killer: { kind: 'mage', elite: true } } : undefined);
  });
  it('does not leave an empty suit and defaults an unknown death to self', () => {
    const s = GridSim.create(3).s; s.outcome = 'dead';
    expect(settleRun(freshMeta(), s).suit).toBeUndefined();
    s.hero.suit = ['dash'];
    expect(settleRun(freshMeta(), s).suit?.killer).toEqual({ kind: 'self' });
  });
});
