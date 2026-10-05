import { expect, it } from 'vitest';
import { act, arena } from '../../src/sim/souls/soulsSim';

/** A soldier right above the hero shows its swing at once (it lands 0.9 later); a guard of 0.8 leaves it pending. */
function pending(id: 'soldier' | 'brute' = 'soldier') {
  const g = arena([{ id, x: 6, y: 5 }]);
  const first = act(g, { kind: 'guard' });
  return { g, first };
}

it('a foe in reach shows its attack before it lands', () => {
  const { g, first } = pending();
  expect(first.some((e) => e.type === 'telegraph')).toBe(true);
  expect(g.s.telegraphs.length).toBe(1);
  expect(g.s.time).toBeCloseTo(0.8);
});

it('a dodge out of the shown cells makes the blow miss', () => {
  const { g } = pending();
  const ev = act(g, { kind: 'dodge', dir: { x: 1, y: 0 } });
  expect(ev.some((e) => e.type === 'miss' && e.dst === 'hero')).toBe(true);
  expect(g.s.hero.hp).toBe(100);
});

it('a parry in its window staggers the foe and takes no damage', () => {
  const { g } = pending();
  const ev = act(g, { kind: 'parry' });
  expect(ev.some((e) => e.type === 'parry' && e.src === 'hero')).toBe(true);
  expect(g.s.hero.hp).toBe(100);
  expect(g.foes[0]!.staggerUntil).toBeGreaterThan(g.s.time);
});

it('a blow that cannot be parried goes through a parry', () => {
  const { g } = pending('brute');
  // the brute's slam lands 1.4 after it is shown: guard runs out first, then the parry is too early to matter anyway
  const ev = act(g, { kind: 'parry' });
  const later = ev.some((e) => e.type === 'hit' && e.dst === 'hero') ? ev : act(g, { kind: 'parry' });
  expect(later.some((e) => e.type === 'parry' && e.src === 'hero')).toBe(false);
  expect(g.s.hero.hp).toBeLessThan(100);
});

it('a guard takes most of the blow out of health and puts it on stamina', () => {
  const g = arena([{ id: 'soldier', x: 6, y: 5 }]);
  act(g, { kind: 'guard' });
  const ev = act(g, { kind: 'guard' });
  expect(ev.some((e) => e.type === 'hit' && e.dst === 'hero')).toBe(true);
  expect(g.s.hero.hp).toBeGreaterThan(90);
  expect(g.hero.stamina).toBeLessThan(100);
});

it('attacking into a shown blow trades: the hero strikes, then is hit', () => {
  const { g } = pending();
  const ev = act(g, { kind: 'light' });
  const struck = ev.findIndex((e) => e.type === 'hit' && e.dst !== 'hero');
  const hurt = ev.findIndex((e) => e.type === 'hit' && e.dst === 'hero');
  expect(hurt).toBeGreaterThanOrEqual(0);
  // the longsword lands at 0.4 into its swing, after the soldier's blow at 0.9 (the swing started at 0.8)
  expect(hurt).toBeLessThan(struck === -1 ? Infinity : struck);
});

it('striking a staggered foe is a critical hit', () => {
  const { g } = pending();
  act(g, { kind: 'parry' });
  const ev = act(g, { kind: 'light' });
  expect(ev.some((e) => e.type === 'hit' && e.dst !== 'hero' && e.crit)).toBe(true);
});

it('one defence parries a blow that lands in its first moments and guards a later one', () => {
  // the soldier's swing lands 0.9 after it is shown: defending at 0.8 catches it 0.1 in — a parry
  const early = arena([{ id: 'soldier', x: 6, y: 5 }]);
  act(early, { kind: 'guard' });
  expect(act(early, { kind: 'defend' }).some((e) => e.type === 'parry' && e.src === 'hero')).toBe(true);
  // after a dagger jab (0.6) the swing is 0.3 away: past the 0.25 parry window, so it is guarded
  const late = arena([{ id: 'soldier', x: 6, y: 5 }], 'dagger');
  act(late, { kind: 'light' });
  const ev = act(late, { kind: 'defend' });
  expect(ev.some((e) => e.type === 'parry' && e.src === 'hero')).toBe(false);
  expect(ev.some((e) => e.type === 'shield' && e.src === 'hero')).toBe(true);
});
