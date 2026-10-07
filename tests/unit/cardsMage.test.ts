import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { damage, entOf, strike, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { implant } from '../../src/sim/roam/roam';
import { action, emit, sourcesOf } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { ultSlots, useUltimate } from '../../src/sim/party/ultimate';
import type { GEvent } from '../../src/sim/grid/types';

const scene = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 1; y < 13; y++) for (let x = 1; x < 20; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 4, y: 6 };
  implant(p, u, 'mage', []);
  const foes = p.units.filter((x) => x.side === 'foe');
  for (const f of foes) { entOf(p, f.id)!.alive = false; f.reaped = true; f.raised = true; }
  const put = (k: number, x: number, y: number, hp = 999): Unit => {
    const f = foes[k]!, e = entOf(p, f.id)!;
    e.alive = true; e.hp = e.maxHp = hp; e.pos = { x, y }; f.asleep = false; f.reaped = false; f.raised = false; f.nextAt = 999; f.status = {};
    return f;
  };
  p.s.rng.chance = () => true;
  const turn = (t: number) => { const ev: GEvent[] = []; action(p, () => emit(p, 'turn', { t, src: u, ev })); return ev; };
  return { p, u, put, turn };
};
const hp = (p: ReturnType<typeof scene>['p'], f: Unit) => entOf(p, f.id)!.hp;

it('the mage has twelve cards in three branches; its innates are the element cycle and shatter', () => {
  const cards = Object.values(TRAITS).filter((d) => d.pool === 'mage');
  expect(cards).toHaveLength(12);
  for (const b of ['mage:fire', 'mage:cold', 'mage:lightning']) expect(cards.filter((d) => d.branch === b && d.sig)).toHaveLength(1);
  const { p, u } = scene();
  expect(sourcesOf(p, u).map((d) => d.id)).toEqual(expect.arrayContaining(['원소 순환', '파쇄']));
});

it('meteor: while a burning foe lives a meteor falls on it every turn; a meteor kill brings another', () => {
  const { p, u, put, turn } = scene(); u.traits = { meteor: 1 };
  const a = put(0, 10, 6);
  expect(turn(1).some((e) => e.text === '운석')).toBe(false);
  applyStatus(p, u, a, 'burn', 1, []);
  const h = hp(p, a); turn(2); expect(hp(p, a)).toBeLessThan(h);
  const h2 = hp(p, a); turn(3); expect(hp(p, a)).toBeLessThan(h2);
  const weak = put(1, 9, 9, 1), next = put(2, 11, 9); applyStatus(p, u, weak, 'burn', 4, []); applyStatus(p, u, next, 'burn', 4, []);
  entOf(p, a.id)!.alive = false;
  const before = hp(p, next); turn(4);
  expect(entOf(p, weak.id)!.alive).toBe(false); expect(hp(p, next)).toBeLessThan(before);
});

it('fireball: every third blow bursts in fire round the target', () => {
  const { p, u, put } = scene(); u.traits = { fireball: 1 };
  const a = put(0, 8, 6), b = put(1, 9, 6);
  // the staff splashes every blow; the third one adds the fireball on top
  strike(p, u, a, 0, []); const h1 = hp(p, b); strike(p, u, a, 1, []); const splash = h1 - hp(p, b), h2 = hp(p, b);
  strike(p, u, a, 2, []); expect(h2 - hp(p, b)).toBeGreaterThan(splash);
});

it('blizzard: after two turns near one spot snow falls round the mage every turn; moving off stops it', () => {
  const { p, u, put, turn } = scene(); u.traits = { blizzard: 1 };
  const a = put(0, 5, 7);
  turn(1); expect(hp(p, a)).toBe(999);
  turn(3); const h = hp(p, a); expect(h).toBeLessThan(999); expect((a.status.chill?.until ?? 0) > 3).toBe(true);
  turn(4); expect(hp(p, a)).toBeLessThan(h);
  entOf(p, 'hero')!.pos = { x: 12, y: 6 }; const h2 = hp(p, a); turn(5); expect(hp(p, a)).toBe(h2);
});

it('frost ring: a blow taken chills the foes within two and pushes the adjacent ones', () => {
  const { p, u, put } = scene(); u.traits = { frostRing: 1 };
  const a = put(0, 5, 6);
  action(p, () => emit(p, 'struck', { t: 1, src: u, target: a, ev: [] }));
  expect((a.status.chill?.until ?? 0) > 1).toBe(true); expect(entOf(p, a.id)!.pos).toEqual({ x: 6, y: 6 });
});

it('chain lightning: while a shocked foe lives, lightning leaps between foes every turn', () => {
  const { p, u, put, turn } = scene(); u.traits = { chainLightning: 1 };
  const a = put(0, 8, 6), b = put(1, 9, 7), c = put(2, 10, 6);
  turn(1); expect(hp(p, b)).toBe(999);
  applyStatus(p, u, a, 'shock', 1, []);
  turn(2); expect(hp(p, b)).toBeLessThan(999); expect(hp(p, c)).toBeLessThan(999);
});

it('static field: a hit takes a share of the current health of every foe within three', () => {
  const { p, u, put } = scene(); u.traits = { staticField: 1 };
  const a = put(0, 6, 6, 500), b = put(1, 7, 7, 500);
  action(p, () => emit(p, 'hit', { t: 1, src: u, target: a, basic: true, ev: [] }));
  expect(hp(p, b)).toBe(500 - 40);
});

it('overcurrent: a shocked foe that is hit passes the shock to the foe beside it', () => {
  const { p, u, put } = scene(); u.traits = { overcurrent: 1 };
  // the cycle's next element is shock (a burn would set off an overload and use the shock up)
  u.cycle = 2;
  const a = put(0, 6, 6), b = put(1, 7, 6);
  applyStatus(p, u, a, 'shock', 0, []);
  action(p, () => emit(p, 'hit', { t: 1, src: u, target: a, ev: [] }));
  expect((b.status.shock?.until ?? 0) > 1).toBe(true);
});

it('fire mastery multiplies fire damage by 1.15 per #화염', () => {
  const { p, u, put } = scene(); u.traits = { fireAmp: 1, meteor: 1, fireball: 1 };
  const a = put(0, 8, 6, 1000);
  action(p, () => damage(p, 0, u.id, a, 100, [], true, false, 'fire'));
  expect(1000 - hp(p, a)).toBe(Math.round(100 * 1.15 ** 3));
});

it('teleport: the mage blinks to the chosen floor cell and both ends burst with its next element', () => {
  const { p, u, put } = scene();
  expect(ultSlots(u).map((s) => s.ult)).toEqual(['teleport']);
  const near = put(0, 5, 6), far = put(1, 12, 7);
  expect(useUltimate(p, 'hero', { x: 12, y: 6 }, 0).length).toBeGreaterThan(0);
  expect(entOf(p, 'hero')!.pos).toEqual({ x: 12, y: 6 });
  expect(hp(p, near)).toBeLessThan(999); expect(hp(p, far)).toBeLessThan(999);
  u.souls![0]!.ultReady = 0;
  p.s.map.tiles[6 * p.s.map.w + 15] = 'wall';
  expect(useUltimate(p, 'hero', { x: 15, y: 6 }, 0)).toEqual([]);
});
