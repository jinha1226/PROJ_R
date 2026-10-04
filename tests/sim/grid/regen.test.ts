import { expect, it } from 'vitest';
import { regenerate } from '../../../src/sim/grid/regen';
import { OPEN, sim } from './kit';
const alone = () => { const g = sim(OPEN, { x: 2, y: 2 }); g.s.hero.hp = 20; return g; };
it('heals one HP after six waits alone', () => {
  const g = alone();
  for (let i = 0; i < 5; i++) g.act({ kind: 'wait' });
  expect(g.s.hero.hp).toBe(20);
  g.act({ kind: 'wait' }); expect(g.s.hero.hp).toBe(21);
});
it('resets banked time for an awake visible foe', () => {
  const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'minion', pos: { x: 5, y: 2 } }]);
  g.s.hero.hp = 20; g.s.hero.regenClock = 5;
  regenerate(g.s, 6);
  expect(g.s.hero.hp).toBe(20); expect(g.s.hero.regenClock).toBe(0);
});
it.each(['burn', 'poison'] as const)('does not recover during %s, including its last tick', (kind) => {
  const g = alone(); g.s.hero.regenClock = 5;
  g.s.hero.status = { burn: 0, freeze: 0, poison: 0, [kind]: 1 };
  g.act({ kind: 'wait' });
  expect(g.s.hero.hp).toBe(kind === 'burn' ? 18 : 19);
  expect(g.s.hero.regenClock).toBe(0);
});
it('caps HP and discards time banked at full health', () => {
  const g = alone(); g.s.hero.hp = g.s.hero.maxHp - 1;
  regenerate(g.s, 12);
  expect(g.s.hero.hp).toBe(g.s.hero.maxHp); expect(g.s.hero.regenClock).toBe(0);
});
it('zero-cost choices add no recovery time', () => {
  const g = alone(); g.s.hero.regenClock = 5; g.s.offers.push(['dash']);
  g.act({ kind: 'choose', i: null });
  expect(g.s.hero.hp).toBe(20); expect(g.s.hero.regenClock).toBe(5);
});
it('counts fractional time and ignores asleep, dead, distant or unseen foes', () => {
  const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'minion', pos: { x: 5, y: 2 }, awake: false }]);
  g.s.hero.hp = 20;
  for (let i = 0; i < 12; i++) regenerate(g.s, 0.5);
  expect(g.s.hero.hp).toBe(21);
  g.s.foes[0]!.awake = true; g.s.visible.clear(); regenerate(g.s, 6);
  expect(g.s.hero.hp).toBe(22);
});
it('marks a passive recovery as regen so the view does not play the drinking motion', () => {
  const g = alone(); g.s.hero.regenClock = 5;
  regenerate(g.s, 1);
  expect(g.s.events.find((e) => e.type === 'heal')?.text).toBe('regen');
});
