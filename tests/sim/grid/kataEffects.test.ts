import { expect, it } from 'vitest';
import { canRun, runEffect, type EffectId } from '../../../src/sim/grid/kataEffects';
import { addStatus } from '../../../src/sim/grid/status';
import { makeWeapon } from '../../../src/sim/grid/items';
import { idx } from '../../../src/sim/grid/types';
import { OPEN, sim, sureHits } from './kit';

it.each(['shootNearest', 'shootFoe', 'dashSlash', 'spinShot', 'slashFoe', 'execute', 'push', 'stun', 'elementBurst'] satisfies EffectId[])(
  '%s without a target is a pure no-op', effect => {
    const { s } = sim(OPEN, { x: 5, y: 7 }); s.hero.suit = [];
    const before = JSON.stringify(s);
    expect(canRun(s, effect, { t: 0 })).toBe(false);
    expect(runEffect(s, effect, { t: 0 })).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
it('slashFoe uses the off-hand blade and restores the gun', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]); sureHits(g); g.s.hero.suit = [];
  const f = g.s.foes[0]!;
  expect(runEffect(g.s, 'slashFoe', { t: 0, foe: f })).toBe(true);
  expect(f.hp).toBeLessThan(f.maxHp); expect(g.s.hero.gear.active).toBe(0);
});
it('push slams against a wall, emitting stunned through the bus', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
  s.hero.suit = ['execute']; s.map.tiles[idx(s.map, { x: 7, y: 7 })] = 'wall';
  runEffect(s, 'push', { t: 0, foe: s.foes[0] });
  expect(s.foes[0]!.alive).toBe(false); expect(s.fired.has('execute')).toBe(true);
});
it('refund restores the actual charge cost, capped at capacity', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 }); s.hero.charge = 2;
  runEffect(s, 'refund', { t: 0, shotCost: 3 }); expect(s.hero.charge).toBe(5);
  runEffect(s, 'refund', { t: 0, shotCost: 30 }); expect(s.hero.charge).toBe(s.hero.maxCharge);
});
it.each(['brute', 'champion'] as const)('engraving stun and frost respect the %s duration cap', kind => {
  const { s } = sim(OPEN, { x: 5, y: 7 }, [{ kind, pos: { x: 6, y: 7 } }]);
  s.hero.suit = ['alternate', 'echo', 'chain']; const f = s.foes[0]!;
  runEffect(s, 'stun', { t: 0, foe: f }, 2);
  runEffect(s, 'stun', { t: 0, foe: f }, 2);
  expect(f.stun).toBe(kind === 'champion' ? 1 : 4);
  runEffect(s, 'elementBurst', { t: 0, foe: f, element: 'frost' }, 0);
  expect(f.status?.freeze).toBe(kind === 'champion' ? 1 : 3);
  addStatus(s, 0, f, 'frost', s.hero.id, true);
  expect(f.status?.freeze).toBe(kind === 'champion' ? 1 : 3);
});
it('a charged engraving shot spends the gun cost and cannot shoot with insufficient charge', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]); sureHits(g);
  g.s.hero.suit = []; g.s.hero.gear.hands[0] = makeWeapon('staff', 1); g.s.hero.charge = 2;
  runEffect(g.s, 'shootFoe', { t: 0, foe: g.s.foes[0] }); expect(g.s.hero.charge).toBe(0);
  const before = JSON.stringify(g.s);
  expect(runEffect(g.s, 'shootFoe', { t: 0, foe: g.s.foes[0] })).toBe(false);
  expect(JSON.stringify(g.s)).toBe(before);
});

it('champion caps apply to engraving elements without changing ordinary status durations', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'champion', pos: { x: 7, y: 7 } }]);
  s.hero.suit = []; const f = s.foes[0]!;
  addStatus(s, 0, f, 'frost', s.hero.id); expect(f.status?.freeze).toBe(2);
  runEffect(s, 'elementBurst', { t: 0, foe: f, element: 'frost' }, 0); expect(f.status?.freeze).toBe(1);
  f.status = { burn: 0, freeze: 0, poison: 3 }; f.stun = 3;
  runEffect(s, 'elementBurst', { t: 0, foe: f, element: 'shock' }, 0); expect(f.stun).toBe(1);
});
