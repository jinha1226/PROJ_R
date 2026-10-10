import { afterEach, expect, it } from 'vitest';
import { idx, type GEvent } from '../../src/sim/grid/types';
import { AUTOHIT, autoHitTurn, rouseBand } from '../../src/sim/party/autoHit';
import { entOf, stats } from '../../src/sim/party/partyCore';
import { scene, put } from './support/cardScene';

afterEach(() => { AUTOHIT.on = false; });
const see = (p: ReturnType<typeof scene>['p'], ...fs: { id: string }[]): void => { for (const f of fs) p.s.visible.add(idx(p.s.map, entOf(p, f.id)!.pos)); };

it('blows by themselves: a foe in reach is struck when the blow is due, and the clone never steps by itself', () => {
  const { p, u, foes } = scene('warrior'); const [a, b] = foes; put(p, a!, 5, 4, 999); put(p, b!, 8, 4, 999); see(p, a!, b!);
  p.s.rng.chance = () => true; p.leader = u.id;
  const atk = stats(u, 0, p).atk, ev: GEvent[] = [];
  const wait = autoHitTurn(p, u, 0, ev);
  expect(entOf(p, a!.id)!.hp).toBeLessThan(999); expect(u.swingAt).toBeCloseTo(atk);
  // the next moment is the next blow; nothing lands before it is due
  expect(wait).toBeGreaterThan(0.5); expect(wait).toBeLessThanOrEqual(atk);
  const hp = entOf(p, a!.id)!.hp;
  autoHitTurn(p, u, 0.3, ev); expect(entOf(p, a!.id)!.hp).toBe(hp);
  autoHitTurn(p, u, atk, ev); expect(entOf(p, a!.id)!.hp).toBeLessThan(hp);
  // the far one is left alone and nobody walks to it
  expect(entOf(p, b!.id)!.hp).toBe(999); expect(entOf(p, u.id)!.pos).toEqual({ x: 4, y: 4 });
});

it('a walk is the only thing asked: it is taken a step a moment, swinging on the way, and any other order is dropped', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 4, 5, 999); see(p, a!);
  p.s.rng.chance = () => true; p.leader = u.id;
  u.order = { kind: 'attack', target: a!.id };
  autoHitTurn(p, u, 0, []); expect(u.order).toBeNull();
  u.order = { kind: 'move', cell: { x: 6, y: 4 } }; u.swingAt = 0;
  const hp = entOf(p, a!.id)!.hp, move = stats(u, 1, p).move;
  expect(autoHitTurn(p, u, 2, [])).toBe(move);
  expect(entOf(p, u.id)!.pos).toEqual({ x: 5, y: 4 }); expect(entOf(p, a!.id)!.hp).toBeLessThan(hp);
  autoHitTurn(p, u, 2 + move, []); expect(entOf(p, u.id)!.pos).toEqual({ x: 6, y: 4 }); expect(u.order).toBeNull();
});

it('the floor closes in: the sleeping band nearest the clones wakes whole and stays up', () => {
  const { p, foes } = scene('warrior'); const [a, b, c] = foes;
  put(p, a!, 9, 4); put(p, b!, 10, 4); put(p, c!, 12, 8);
  for (const f of foes) { f.asleep = true; f.group = 9; }
  a!.group = b!.group = 1; c!.group = 2;
  expect(rouseBand(p, 10)).toBe(true);
  expect([a!.asleep, b!.asleep, c!.asleep]).toEqual([false, false, true]); expect(a!.alertUntil).toBeGreaterThan(100);
  for (const f of foes) f.asleep = false;
  expect(rouseBand(p, 20)).toBe(false);
});
