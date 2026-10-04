import { expect, it } from 'vitest';
import { buy, engraveShop, freshMeta, settleRun } from '../../../src/sim/grid/meta';
import { newRunState } from '../../../src/sim/grid/runSetup';
it('starts with two permanent engravings and independent defaults', () => {
  expect(freshMeta()).toMatchObject({ unlocked: ['gunRelay', 'spinShot'], tasted: [], facilities: { suitSlots: 2 } });
});
it('buys only locked base engravings and consumes the tasted discount', () => {
  const m = freshMeta(); m.repairs = ['suitlab']; m.tasted = ['flow'];
  expect(engraveShop(m).find(e => e.id === 'engrave:flow')?.cost).toBe(60);
  expect(engraveShop(m).some(e => e.id === 'engrave:gunRelay')).toBe(false);
  m.energy = 59; expect(buy(m, 'engrave:flow')).toBe(false);
  m.energy = 60; expect(buy(m, 'engrave:flow')).toBe(true);
  expect(m.energy).toBe(0); expect(m.unlocked).toContain('flow'); expect(m.tasted).toEqual([]);
  m.energy = 1000;
  expect(buy(m, 'engrave:flow')).toBe(false); expect(buy(m, 'engrave:rapid')).toBe(true);
  expect(buy(m, 'engrave:bladeRelay')).toBe(true); expect(m.energy).toBe(890);
});
it('autofills only empty selections, filters explicit selections, and copies unlocks', () => {
  const m = freshMeta();
  const s = newRunState(1, m, { gun: 'pistol', start: 1, startSuit: [] });
  expect(s.hero.suit).toEqual(m.unlocked); expect(s.run.unlocked).toEqual(m.unlocked);
  expect(s.run.unlocked).not.toBe(m.unlocked);
  expect(newRunState(1, m, { gun: 'pistol', start: 1, startSuit: ['flow', 'spinShot', 'spinShot'] }).hero.suit).toEqual(['spinShot']);
  expect(newRunState(1, m, { gun: 'pistol', start: 6, startSuit: [] }).hero.suit).toEqual([]);
});
it('settles unique locked tastes and pays for every recovered engraving', () => {
  const m = freshMeta(); m.repairs = ['suitlab']; m.tasted = ['flow']; m.startCandidates = ['dash'];
  const s = newRunState(1, m, { gun: 'pistol', start: 1, startSuit: [] });
  s.run.tasted = ['flow', 'gunRelay', 'counterShot']; s.run.recovered = ['execute', 'rapid', 'gunRelay'];
  s.run.energy = 5;
  const result = settleRun(m, s);
  expect(result.energy).toBe(35); expect(result.tasted).toEqual(['flow', 'counterShot', 'execute', 'rapid']);
  expect(result.startCandidates).toEqual(['dash']); expect(m.energy).toBe(0);
});
