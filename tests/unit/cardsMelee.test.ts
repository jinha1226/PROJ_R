import { expect, it } from 'vitest';
import { damage, entOf, strike, targetOf } from '../../src/sim/party/partyCore';
import { applyStatus } from '../../src/sim/party/status';
import { emit } from '../../src/sim/party/triggers';
import { scene, put } from './support/cardScene';

it('a foe near a warrior goes for the warrior', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 6, 4);
  const other = p.units.find((x) => x.side === 'hero' && x !== u)!; entOf(p, other.id)!.alive = true; other.cls = 'archer'; entOf(p, other.id)!.pos = { x: 7, y: 4 };
  expect(targetOf(p, a!, 0)?.id).toBe(u.id);
});

it('rage builds with each blow taken, is kept through the warrior\'s own blows, and lets go on the fifth', () => {
  const { p, u, foes } = scene('warrior'); const [a, b, far] = foes; put(p, a!, 5, 4, 999); put(p, b!, 3, 4, 999); put(p, far!, 7, 4, 999);
  u.traits = { rage: 1 };
  for (let i = 0; i < 3; i++) damage(p, i * 2, a!.id, u, 1, [], false, false, 'physical', true);
  expect(u.rage).toBe(3);
  p.s.rng.chance = () => true; strike(p, u, a!, 7, []); expect(u.rage).toBe(3);
  const before = [a!, b!, far!].map((f) => entOf(p, f.id)!.hp);
  damage(p, 10, a!.id, u, 1, [], false, false, 'physical', true); expect(u.rage).toBe(4);
  const ev: { type: string; text?: string }[] = [];
  damage(p, 12, a!.id, u, 1, ev as never, false, false, 'physical', true);
  expect(u.rage).toBe(0); expect(ev.some((e) => e.type === 'buff' && e.text === '분노 폭발')).toBe(true);
  // everyone beside the warrior takes it; the one two cells off does not (rank 1)
  expect(entOf(p, a!.id)!.hp).toBeLessThan(before[0]!); expect(entOf(p, b!.id)!.hp).toBeLessThan(before[1]!); expect(entOf(p, far!.id)!.hp).toBe(before[2]!);
});

it('rage 2 reaches two cells; a rage filled from elsewhere lets go on the turn', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 6, 4, 999);
  u.traits = { rage: 2 }; u.rage = 5;
  emit(p, 'turn', { t: 1, src: u, ev: [] });
  expect(u.rage).toBe(0); expect(entOf(p, a!.id)!.hp).toBeLessThan(999);
});

it('iron counter: a blow from a foe beside the warrior is answered at half strength; one from afar is not', () => {
  const { p, u, foes } = scene('warrior'); const [a, b] = foes; put(p, a!, 5, 4, 999); put(p, b!, 8, 4, 999);
  p.s.rng.chance = () => true; p.s.rng.next = () => 0.5;
  u.traits = { ironCounter: 1 };
  damage(p, 0, b!.id, u, 1, [], false, false, 'physical', true); expect(entOf(p, b!.id)!.hp).toBe(999);
  const ev: { type: string; text?: string }[] = [];
  damage(p, 2, a!.id, u, 1, ev as never, false, false, 'physical', true);
  expect(entOf(p, a!.id)!.hp).toBeLessThan(999); expect(ev.some((e) => e.text === '되받아치기')).toBe(true);
  const half = 999 - entOf(p, a!.id)!.hp;
  // a full blow of its own, for scale
  put(p, a!, 5, 4, 999); u.traits = {}; strike(p, u, a!, 4, []);
  expect(half).toBeLessThan(999 - entOf(p, a!.id)!.hp);
});

it('vitals: each state on the foe adds a quarter', () => {
  const run = (states: boolean) => {
    const { p, u, foes } = scene('rogue'); u.weapon = 'daggers'; u.gear = undefined; const [a] = foes; put(p, a!, 5, 4, 999);
    if (states) { applyStatus(p, u, a!, 'poison', 0, []); applyStatus(p, u, a!, 'bleed', 0, []); }
    u.traits = { vitals: 1 }; p.s.rng.chance = () => true; p.s.rng.int = () => 10; a!.order = { kind: 'attack', target: u.id };
    strike(p, u, a!, 0.1, []); return 999 - entOf(p, a!.id)!.hp;
  };
  expect(run(true)).toBeGreaterThan(run(false));
});

