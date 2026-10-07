import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { action } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { ultSlots, useUltimate } from '../../src/sim/party/ultimate';
import { markMult } from '../../src/sim/party/cardsRanged';
import { tagsOf } from '../../src/sim/party/classKit';
import { classScene } from './support/classScene';

const scene = () => classScene('archer');
const marked = (f: { status: { mark?: { until: number } } }, t: number) => (f.status.mark?.until ?? 0) > t;

it('twelve archer cards in three branches with their ranks; arrow rain is its ultimate', () => {
  const cards = Object.values(TRAITS).filter((d) => d.pool === 'archer');
  expect(cards).toHaveLength(12);
  for (const b of ['archer:volley', 'archer:element', 'archer:precision']) expect(cards.filter((d) => d.branch === b && d.sig)).toHaveLength(1);
  for (const d of cards) expect(d.ranks, d.id).toBe(d.kind === 'law' ? 3 : 2);
  expect(ultSlots(scene().u).map((s) => s.ult)).toEqual(['arrowRain']);
});

it('multishot: a marked foe dying opens the volley — every shot then hits every foe within four and marks it; kills add turns up to six', () => {
  const { p, u, put, hp } = scene(); u.traits = { multiShot: 1 };
  const a = put(0, 8, 6, 1), b = put(1, 9, 6), c = put(2, 7, 9);
  applyStatus(p, u, a, 'mark', 0, []);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(u.volleyUntil).toBe(3);
  strike(p, u, b, 2, []);
  expect(hp(c)).toBeLessThan(999); expect(marked(c, 2)).toBe(true);
  for (let k = 0; k < 9; k++) { const f = put(3 + k, 10, 9, 1); action(p, () => damage(p, 2, u.id, f, 99, [], true)); }
  expect(u.volleyUntil).toBe(8);
});

it('multishot 3: a kill in the volley looses one more arrow at the nearest foe', () => {
  const { p, u, put, hp } = scene(); u.traits = { multiShot: 3 }; u.volleyUntil = 5;
  const a = put(0, 8, 6, 1), b = put(1, 12, 6);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(hp(b)).toBeLessThan(999);
});

it('hunting mark: the first shot of a fight marks; 2 moves the mark on a kill; 3 marks two', () => {
  const { p, u, put, fire } = scene(); u.traits = { huntMark: 3 };
  const a = put(0, 8, 6), b = put(1, 9, 7);
  fire('combatStart', 0);
  strike(p, u, a, 0.5, []);
  expect(marked(a, 0.5) && marked(b, 0.5)).toBe(true);
});

it('hunter’s instinct: a marked foe’s death makes the next shot critical (2: the next two)', () => {
  const { p, u, put } = scene(); u.traits = { hunterInstinct: 2 };
  const a = put(0, 8, 6, 1); applyStatus(p, u, a, 'mark', 0, []);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(u.nextCrit).toBe(true); expect(u.critShots).toBe(1);
});

it('hunter’s eye multiplies the mark by 1.1 per #원거리 (1.14 at rank 2)', () => {
  const { u } = scene(); u.traits = { hunterEye: 1, multiShot: 1, huntMark: 1 };
  // the bow in hand counts too
  const n = tagsOf(u).원거리 ?? 0; expect(n).toBeGreaterThanOrEqual(3);
  expect(markMult(u)).toBeCloseTo(1.3 * 1.1 ** n);
  u.traits.hunterEye = 2; expect(markMult(u)).toBeCloseTo(1.3 * 1.14 ** n);
});

it('explosive arrow: every arrow bursts in fire round the target (2: two cells; 3: a kill leaves burning ground)', () => {
  const { p, u, put, hp } = scene(); u.traits = { explosiveArrow: 3 };
  const a = put(0, 8, 6), b = put(1, 10, 6), weak = put(2, 9, 7, 1);
  strike(p, u, a, 1, []);
  expect(hp(b)).toBeLessThan(999); expect((b.status.burn?.until ?? 0) > 1).toBe(true);
  expect(entOf(p, weak.id)!.alive).toBe(false);
  expect(p.grounds?.some((g) => g.by === u.id)).toBe(true);
});

it('freezing arrow: a shot from steady aim three freezes the target and the foes beside it; 3: the next arrow shatters it', () => {
  const { p, u, put, hp } = scene(); u.traits = { freezeArrow: 3 }; u.steady = 3; u.still = 3;
  const a = put(0, 8, 6, 5000), b = put(1, 9, 6);
  strike(p, u, a, 1, []);
  expect((a.status.freeze?.until ?? 0) > 1 && (b.status.freeze?.until ?? 0) > 1).toBe(true);
  // the next shot is from a fresh spot (steady aim one: no new freeze)
  u.steady = 0; u.still = 0; const before = hp(a); strike(p, u, a, 1.5, []); const shattered = before - hp(a);
  const plain = (() => { const s = scene(); s.u.traits = {}; const f = s.put(0, 8, 6, 5000); strike(s.p, s.u, f, 1, []); return 5000 - s.hp(f); })();
  expect(shattered).toBeGreaterThan(plain * 1.5); expect(a.status.freeze).toBeUndefined();
});

it('element mesh: reactions the archer sets off hit twice as hard (3× at rank 2)', () => {
  const run = (r: number) => {
    const s = scene(); s.u.traits = r ? { elementMesh: r } : {};
    const a = s.put(0, 8, 6), b = s.put(1, 9, 6);
    applyStatus(s.p, s.u, a, 'burn', 0, []); applyStatus(s.p, s.u, a, 'shock', 0, []);
    return 999 - s.hp(b);
  };
  expect(run(1)).toBe(run(0) * 2); expect(run(2)).toBe(run(0) * 3);
});

it('element archer: fire and cold damage ×1.12 per #화염 and #냉기', () => {
  const { p, u, put, hp } = scene(); u.traits = { elementShooter: 1, explosiveArrow: 1 };
  const a = put(0, 8, 6, 1000);
  action(p, () => damage(p, 0, u.id, a, 100, [], true, false, 'fire'));
  // #화염 2 (both cards) and #냉기 1
  expect(1000 - hp(a)).toBe(Math.round(100 * 1.12 ** 3));
});

it('piercing arrow: every arrow runs on through the foe behind, each foe pierced adding a tenth to the next arrow (to a half); a miss resets it', () => {
  const { p, u, put, hp } = scene(); u.traits = { pierce: 1 };
  const a = put(0, 7, 6, 5000), b = put(1, 9, 6);
  strike(p, u, a, 1, []);
  expect(hp(b)).toBeLessThan(999); expect(u.pierceStack).toBe(1);
  p.s.rng.chance = () => false; strike(p, u, a, 2, []);
  expect(u.pierceStack).toBe(0);
});

it('piercing arrow 3: an arrow through three foes makes the next one critical', () => {
  const { p, u, put } = scene(); u.traits = { pierce: 3 };
  const a = put(0, 6, 6, 5000); put(1, 7, 6); put(2, 8, 6);
  u.nextCrit = false; p.s.rng.chance = (c) => c > 0.5;
  strike(p, u, a, 1, []);
  expect(u.nextCrit).toBe(true);
});

it('homing arrow: a miss curves to the nearest other foe (3: and marks it)', () => {
  const { p, u, put, hp } = scene(); u.traits = { homing: 3 };
  const a = put(0, 8, 6), b = put(1, 9, 8);
  p.s.rng.chance = () => false;
  strike(p, u, a, 1, []);
  expect(hp(b)).toBeLessThan(999); expect(marked(b, 1)).toBe(true);
});

it('expose weakness: a critical hit exposes the target (2: and the foes beside it)', () => {
  const { u, put, fire } = scene(); u.traits = { exposeWeakness: 2 };
  const a = put(0, 8, 6), b = put(1, 9, 6);
  fire('crit', 1, { target: a });
  expect((a.status.exposed?.until ?? 0) > 1 && (b.status.exposed?.until ?? 0) > 1).toBe(true);
});

it('focus fire: each still shot adds a tenth to critical chance up to four', () => {
  const { u } = scene(); u.still = 6;
  expect(TRAITS.focusFire!.passive!(u, 1).crit).toBeCloseTo(0.4);
  expect(TRAITS.focusFire!.passive!(u, 2).crit).toBeCloseTo(0.6);
});

it('arrow rain marks what it hits', () => {
  const { p, put } = scene();
  const a = put(0, 9, 6);
  expect(useUltimate(p, 'hero', { x: 9, y: 6 }, 0).length).toBeGreaterThan(0);
  expect(marked(a, p.time)).toBe(true);
});
