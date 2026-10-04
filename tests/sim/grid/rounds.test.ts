import { createRng } from '../../../src/core/rng';
import { expect, it } from 'vitest';
import { OPEN, sim, sureHits } from './kit';
import { meleeAttack, rangedAttack, shootCell } from '../../../src/sim/grid/weapons';
import { makeWeapon } from '../../../src/sim/grid/items';
import { freshMeta } from '../../../src/sim/grid/meta';
import { newRunState } from '../../../src/sim/grid/runSetup';
import { offerFor } from '../../../src/sim/grid/engrave';
import { absorbOffer } from '../../../src/sim/grid/absorb';
const hooks = { noise: () => {} };
const setup = () => {
  const g = sim(OPEN, { x: 3, y: 7 }, [7, 8, 9].map(x => ({ kind: 'brute' as const, pos: { x, y: 7 } })));
  sureHits(g); g.s.hero.suit = [];
  g.s.foes.forEach(f => { f.hp = 999; f.awake = true; });
  return g;
};
it('applies fire on a hit, not a miss, and never spends or advances an unavailable shot', () => {
  const g = setup(), f = g.s.foes[0]!; g.s.hero.rounds = ['fire', 'poison'];
  rangedAttack(g.s, 0, f, hooks); expect(f.status?.burn).toBe(3); expect(g.s.hero.roundIdx).toBe(1);
  g.s.rng.chance = () => false;
  rangedAttack(g.s, 1, f, hooks); expect(f.status?.poison ?? 0).toBe(0); expect(g.s.hero.roundIdx).toBe(0);
  g.s.hero.charge = 0; expect(rangedAttack(g.s, 2, f, hooks)).toBeNull(); expect(g.s.hero.roundIdx).toBe(0);
});
it('shock reacts with poison and damages a neighbour', () => {
  const g = setup(); g.s.hero.rounds = ['shock'];
  g.s.foes[0]!.status = { burn: 0, freeze: 0, poison: 6 };
  rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
  expect(g.s.foes[1]!.hp).toBeLessThan(999);
  expect(g.s.events.some(e => e.type === 'react' && e.text === 'paralyse')).toBe(true);
});
it('alternates barrel shots too', () => {
  const g = setup(); g.s.foes = []; g.s.hero.rounds = ['fire', 'frost']; g.s.barrels = [{ x: 7, y: 7 }];
  shootCell(g.s, 0, g.s.barrels[0]!, () => {}); expect(g.s.hero.roundIdx).toBe(1);
});
it('only the chosen unlocked round is applied; locked and missing choices are plain', () => {
  const m = freshMeta(); m.rounds = ['fire', 'shock'];
  const opts = { gun: 'pistol' as const, start: 1 as const, startSuit: [] };
  expect(newRunState(1, m, { ...opts, round: 'fire' }).hero.rounds).toEqual(['fire']);
  expect(newRunState(1, m, { ...opts, round: 'frost' }).hero.rounds).toEqual([]);
  expect(newRunState(1, m, opts).hero.rounds).toEqual([]);
});
it('alternate boosts only a changed element with two rounds and fires once per action', () => {
  const g = setup(), f = g.s.foes[0]!; g.s.hero.rounds = ['poison', 'shock']; g.s.hero.suit = ['alternate'];
  rangedAttack(g.s, 0, f, hooks); rangedAttack(g.s, 1, f, hooks); rangedAttack(g.s, 2, f, hooks);
  expect(g.s.events.filter(e => e.type === 'hit' && !e.text).map(e => e.amount)).toEqual([4, 6, 4]);
  expect(g.s.events.filter(e => e.type === 'engrave' && e.text === 'alternate')).toHaveLength(1);
});
it('echo repeats the third shot element without another bullet or charge', () => {
  const g = setup(), f = g.s.foes[0]!; g.s.hero.rounds = ['poison']; g.s.hero.suit = ['echo'];
  for (let i = 0; i < 3; i++) { g.s.fired.clear(); rangedAttack(g.s, i, f, hooks); }
  expect(f.status?.poison).toBe(24); expect(g.s.hero.charge).toBe(7);
});
it('element blade applies the loaded element on a blade hit and caps champion freeze', () => {
  const g = setup(), f = g.s.foes[0]!; f.kind = 'champion'; f.pos = { x: 4, y: 7 };
  g.s.hero.rounds = ['frost']; g.s.hero.suit = ['elemArrow']; g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
  meleeAttack(g.s, 0, { x: 1, y: 0 }, f); expect(f.status?.freeze).toBe(1); expect(g.s.hero.roundIdx).toBe(0);
});
it('chain repeats a hero reaction on one adjacent foe only once', () => {
  const g = setup(); g.s.hero.rounds = ['shock']; g.s.hero.suit = ['chain'];
  g.s.foes[0]!.status = { burn: 0, freeze: 2, poison: 0 };
  rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
  expect(g.s.events.filter(e => e.type === 'react' && e.text === 'shatter')).toHaveLength(2);
  expect(g.s.events.filter(e => e.type === 'engrave' && e.text === 'chain')).toHaveLength(1);
});
it('level and echo offers can grant a distinct second round without using a suit slot', () => {
  for (const build of [offerFor, (s: import('../../../src/sim/grid/types').GridState) => absorbOffer(s, 'melee')]) {
    const g = setup(); g.s.rng = createRng(123); g.s.hero.rounds = ['fire'];
    const cards = Array.from({ length: 80 }, () => build(g.s)).flat();
    const card = cards.find(c => typeof c === 'object' && c.kind === 'round'); expect(card).toBeDefined();
    g.s.offers = [[card!]]; const before = [...g.s.hero.suit]; g.act({ kind: 'choose', i: 0 });
    expect(g.s.hero.rounds).toHaveLength(2); expect(new Set(g.s.hero.rounds).size).toBe(2); expect(g.s.hero.suit).toEqual(before);
    expect(build(g.s).every(c => typeof c === 'string')).toBe(true);
  }
});
