import { expect, it } from 'vitest';
import { OPEN, sim, sureHits } from './kit';
import { makeWeapon } from '../../../src/sim/grid/items';
import { meleeAttack, rangedAttack } from '../../../src/sim/grid/weapons';
import { counterBlow, lunge } from '../../../src/sim/grid/combos';
import { runEffect } from '../../../src/sim/grid/kataEffects';
import { applyElement } from '../../../src/sim/grid/status';
import { toSave, fromSave } from '../../../src/sim/grid/save';
const hooks = { noise: () => {} };
const setup = () => {
  const g = sim(OPEN, { x: 3, y: 7 }, [7, 8, 9].map(x => ({ kind: 'brute' as const, pos: { x, y: 7 } })));
  sureHits(g); g.s.hero.suit = []; g.s.foes.forEach(f => { f.hp = 999; f.nextAt = 999; });
  return g;
};
it('plain and single-element shots cannot activate alternate or plain echo', () => {
  const g = setup(); g.s.hero.suit = ['alternate', 'echo']; g.s.hero.fx.lastEl = 'frost';
  g.s.hero.rounds = ['fire']; rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
  g.s.hero.rounds = []; rangedAttack(g.s, 1, g.s.foes[0]!, hooks); rangedAttack(g.s, 2, g.s.foes[0]!, hooks);
  expect(g.s.events.some(e => e.type === 'engrave')).toBe(false);
});
it('blade misses and gun bashes do not apply an element; a sweep applies it once', () => {
  const g = setup(), f = g.s.foes[0]!; f.pos = { x: 4, y: 7 };
  g.s.hero.rounds = ['poison']; g.s.hero.suit = ['elemArrow'];
  meleeAttack(g.s, 0, { x: 1, y: 0 }, f); expect(f.status).toBeUndefined();
  g.s.hero.gear.hands[0] = makeWeapon('sword', 1); g.s.rng.chance = () => false;
  meleeAttack(g.s, 1, { x: 1, y: 0 }, f); expect(f.status).toBeUndefined();
  sureHits(g); g.s.hero.gear.hands[0] = makeWeapon('axe', 1); g.s.foes[1]!.pos = { x: 4, y: 8 };
  meleeAttack(g.s, 2, { x: 1, y: 0 }, f);
  expect(g.s.foes.filter(f => f.status?.poison)).toHaveLength(1);
});
it.each(['counter', 'leap'] as const)('element blade works on %s hits', kind => {
  const g = setup(); g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
  g.s.hero.rounds = ['poison']; g.s.hero.suit = ['elemArrow', kind];
  g.s.foes[0]!.pos = { x: kind === 'counter' ? 4 : 6, y: 7 };
  if (kind === 'counter') counterBlow(g.s, 0, 'f1', 'dodge'); else lunge(g.s, 0, { x: 1, y: 0 }, hooks);
  expect(g.s.foes[0]!.status?.poison).toBe(6);
});
it('spin shots carry and alternate loaded rounds', () => {
  const g = setup(); g.s.hero.rounds = ['fire', 'poison'];
  g.s.foes[0]!.pos = { x: 4, y: 7 }; g.s.foes[1]!.pos = { x: 3, y: 8 };
  runEffect(g.s, 'spinShot', { t: 0, foe: g.s.foes[2], neighbours: g.s.foes.slice(0, 2) });
  expect(g.s.foes[0]!.status?.burn).toBe(3); expect(g.s.foes[1]!.status?.poison).toBe(6);
  expect(g.s.hero.roundIdx).toBe(0);
});
it('execute consumes a loaded round even when the target dies', () => {
  const g = setup(); g.s.hero.rounds = ['fire', 'poison']; g.s.foes[0]!.pos = { x: 4, y: 7 };
  runEffect(g.s, 'execute', { t: 0, foe: g.s.foes[0] }); expect(g.s.hero.roundIdx).toBe(1);
});
it('ricochet needs charge and carries the next loaded round', () => {
  for (const charge of [1, 2]) {
    const g = setup(); g.s.hero.charge = charge; g.s.hero.suit = ['ricochet']; g.s.hero.rounds = ['fire', 'poison']; g.s.foes[0]!.hp = 1;
    rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
    expect(g.s.events.some(e => e.type === 'engrave' && e.text === 'ricochet')).toBe(charge === 2);
    expect(g.s.foes[1]!.status?.poison ?? 0).toBe(charge === 2 ? 6 : 0); expect(g.s.hero.charge).toBe(0);
  }
});
it('chain ignores enemy reactions and empty neighbours; spread paralysis caps champions', () => {
  const g = setup(); g.s.hero.suit = ['chain']; const f = g.s.foes[0]!;
  f.status = { burn: 0, freeze: 2, poison: 0 };
  applyElement(g.s, 0, 'shock', f.pos, 0, [1, 2], 'mage'); expect(g.s.fired.has('chain')).toBe(false);
  g.s.foes[1]!.kind = 'champion'; f.status.poison = 6;
  applyElement(g.s, 1, 'shock', f.pos, 0, [1, 2], 'hero'); expect(g.s.foes[1]!.stun).toBe(1);
  expect(g.s.events.filter(e => e.type === 'engrave' && e.text === 'chain')).toHaveLength(1);
});
it('save resumes the loaded index and previous-element and third-shot counters exactly', () => {
  const g = setup(); g.s.hero.rounds = ['fire', 'poison']; g.s.hero.suit = ['alternate', 'echo'];
  rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
  const restored = fromSave(toSave(g.s));
  expect(restored.hero.rounds).toEqual(['fire', 'poison']); expect(restored.hero.roundIdx).toBe(1);
  expect(restored.hero.fx.lastEl).toBe('fire'); expect(restored.hero.fx.roundShots).toBe(1);
});
it('alternate also scales a surviving champion execution shot', () => {
  const g = setup(), f = g.s.foes[0]!; f.kind = 'champion'; f.hp = f.maxHp = 100; f.pos = { x: 4, y: 7 };
  g.s.hero.rounds = ['fire', 'poison']; g.s.hero.roundIdx = 1; g.s.hero.fx.lastEl = 'fire'; g.s.hero.suit = ['alternate'];
  runEffect(g.s, 'execute', { t: 0, foe: f }); expect(f.hp).toBe(62); expect(f.status?.poison).toBe(6);
});
it('volley spends one charge per extra round and stops when empty', () => {
  for (const charge of [1, 2, 3]) {
    const g = setup(); g.s.foes[1]!.pos = { x: 7, y: 9 }; g.s.foes[2]!.pos = { x: 7, y: 5 };
    g.s.hero.suit = ['volley']; g.s.hero.fx.shots = 2; g.s.hero.charge = charge; g.s.hero.rounds = ['poison'];
    rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
    expect(g.s.events.filter(e => e.type === 'shoot')).toHaveLength(charge);
    expect(g.s.foes.filter(f => f.status?.poison)).toHaveLength(charge);
    expect(g.s.hero.charge).toBe(0);
  }
});
it('engraving scrolls keep engraving-only offers', () => {
  const g = setup();
  g.s.rng.pick = <T>(arr: readonly T[]) => arr[arr.length - 1]!;
  g.s.hero.gear.scrolls.engrave = 1;
  g.act({ kind: 'read', sc: 'engrave' });
  expect(g.s.offers[0]).toHaveLength(3);
  expect(g.s.offers[0]!.every(card => typeof card === 'string')).toBe(true);
});
