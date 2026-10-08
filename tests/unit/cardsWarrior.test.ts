import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { action } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { ultSlots, useUltimate } from '../../src/sim/party/ultimate';
import { whirlwind } from '../../src/sim/party/cardsWarrior';
import { classScene } from './support/classScene';

const scene = () => classScene('warrior');

it('twelve warrior cards in three branches, a signature each; earth slam is its ultimate', () => {
  const cards = Object.values(TRAITS).filter((d) => d.pool === 'warrior');
  expect(cards).toHaveLength(12);
  for (const b of ['warrior:whirl', 'warrior:frenzy', 'warrior:shout']) expect(cards.filter((d) => d.branch === b && d.sig)).toHaveLength(1);
  expect(ultSlots(scene().u).map((s) => s.ult)).toEqual(['earthSlam']);
});

it('blade storm: a whirlwind sets the warrior spinning; while it spins every attack sweeps the foes round it and makes them bleed; kills add turns up to six', () => {
  const { p, u, put, hp } = scene(); u.traits = { bladeStorm: 1 };
  const a = put(0, 5, 6), b = put(1, 4, 7), weak = put(2, 3, 5, 1);
  action(p, () => whirlwind(p, u, 1, []));
  // two turns, and one more for the foe the whirlwind itself cut down
  expect(entOf(p, weak.id)!.alive).toBe(false); expect(u.spinUntil).toBe(4);
  const hb = hp(b); strike(p, u, a, 2, []);
  expect(hp(b)).toBeLessThan(hb); expect((b.status.bleed?.until ?? 0) > 2).toBe(true);
  for (let k = 0; k < 9; k++) { const f = put(3 + k, 5, 7, 1); action(p, () => damage(p, 2, u.id, f, 99, [], true)); }
  expect(u.spinUntil).toBe(8);
});

it('blood vortex: a bleeding foe that dies sets off a whirlwind where it fell', () => {
  const { p, u, put, hp } = scene(); u.traits = { bloodVortex: 1 };
  const a = put(0, 9, 6, 1), b = put(1, 10, 7);
  applyStatus(p, u, a, 'bleed', 0, []);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(hp(b)).toBeLessThan(999);
});

it('rend wounds: bleeding stacks to five, then bursts for six per stack', () => {
  const { p, u, put, hp } = scene(); u.traits = { rendWounds: 1 };
  const a = put(0, 9, 6);
  for (let k = 0; k < 4; k++) applyStatus(p, u, a, 'bleed', k * 0.1, []);
  expect(a.status.bleed?.stacks).toBe(4);
  action(p, () => applyStatus(p, u, a, 'bleed', 0.5, []));
  expect(a.status.bleed).toBeUndefined(); expect(hp(a)).toBe(999 - 30);
});

it('blade mastery multiplies the whirlwind by 1.12 per #출혈', () => {
  const run = (amp: boolean) => {
    const { p, u, put, hp } = scene(); u.traits = amp ? { bladeAmp: 1, bloodVortex: 1, rendWounds: 1 } : { bloodVortex: 1, rendWounds: 1 };
    const a = put(0, 6, 6); action(p, () => whirlwind(p, u, 1, [])); return 999 - hp(a);
  };
  expect(run(true) / run(false)).toBeCloseTo(1.12 ** 3, 1);
});

it('frenzy: hits build frenzy to five; at five every attack strikes twice; three turns without a hit clear it', () => {
  const { p, u, put, hp, fire } = scene(); u.traits = { frenzy: 1 };
  const a = put(0, 5, 6, 99999);
  for (let k = 0; k < 6; k++) strike(p, u, a, k, []);
  expect(u.frenzy).toBe(5);
  const before = hp(a); strike(p, u, a, 6, []); const twice = before - hp(a);
  const lone = (() => { const s = scene(); s.u.traits = {}; const f = s.put(0, 5, 6, 99999); strike(s.p, s.u, f, 0, []); return 99999 - s.hp(f); })();
  expect(twice).toBeGreaterThan(lone * 1.5);
  fire('turn', 8); expect(u.frenzy).toBe(5);
  fire('turn', 10); expect(u.frenzy).toBe(0);
});

it('carnage: a kill at full frenzy strikes the next foe at once', () => {
  const { p, u, put, hp } = scene(); u.traits = { frenzy: 1, carnage: 1 };
  const a = put(0, 5, 6, 1), b = put(1, 5, 7);
  u.frenzy = 5; u.frenzyAt = 0;
  strike(p, u, a, 1, []);
  expect(hp(b)).toBeLessThan(999);
});

it('berserk: each frenzy stack adds five percent critical chance', () => {
  const { u } = scene(); u.traits = { frenzy: 1, berserk: 1 }; u.frenzy = 4;
  expect(TRAITS.berserk!.passive!(u, 1).crit).toBeCloseTo(0.2);
});

it('war shout: the fight’s start opens a three-turn shout that taunts within three and stuns the nearest foe each turn; a stunned foe’s death adds a turn', () => {
  const { p, u, put, fire } = scene(); u.traits = { warShout: 1 };
  const a = put(0, 6, 6), weak = put(1, 5, 5, 1);
  fire('combatStart', 0); expect(u.shoutUntil).toBe(3);
  fire('turn', 1);
  // both are taunted; the nearest one (weak) is stunned, the other stays on its feet
  expect(a.tauntBy).toBe(u.id); expect(weak.tauntBy).toBe(u.id);
  expect((weak.status.stun?.until ?? 0) > 1).toBe(true); expect((a.status.stun?.until ?? 0) > 1).toBe(false);
  action(p, () => damage(p, 1, u.id, weak, 99, [], true));
  expect(u.shoutUntil).toBe(4);
});

it('shout mastery: a stunned or taunted foe takes 1.1× per #함성 (multiplied)', () => {
  const { p, u, put, hp } = scene(); u.traits = { shoutAmp: 1, warShout: 1, rage: 1 };
  const a = put(0, 9, 6, 1000);
  a.tauntBy = u.id; a.tauntUntil = 9;
  action(p, () => damage(p, 0, u.id, a, 100, [], true));
  expect(1000 - hp(a)).toBe(Math.round(100 * 1.1 ** 3));
});

it('earth slam: the warrior leaps to a free cell within five, stuns the foes within two and spins a whirlwind; walls, foes and far cells refuse', () => {
  const { p, put, hp } = scene();
  const a = put(0, 8, 7);
  p.s.map.tiles[6 * p.s.map.w + 9] = 'wall';
  expect(useUltimate(p, 'hero', { x: 9, y: 6 }, 0)).toEqual([]);
  expect(useUltimate(p, 'hero', { x: 8, y: 7 }, 0)).toEqual([]);
  expect(useUltimate(p, 'hero', { x: 12, y: 6 }, 0)).toEqual([]);
  expect(useUltimate(p, 'hero', { x: 8, y: 6 }, 0).length).toBeGreaterThan(0);
  expect(entOf(p, 'hero')!.pos).toEqual({ x: 8, y: 6 });
  expect((a.status.stun?.until ?? 0) > 0).toBe(true); expect(hp(a)).toBeLessThan(999);
});
