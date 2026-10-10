import { afterEach, expect, it } from 'vitest';
import { idx } from '../../src/sim/grid/types';
import { AUTOHIT, autoHitTurn, rouseBand } from '../../src/sim/party/autoHit';
import { entOf, stats } from '../../src/sim/party/partyCore';
import { command } from '../../src/sim/party/partySim';
import { scene, put } from './support/cardScene';

afterEach(() => { AUTOHIT.on = false; });
const see = (p: ReturnType<typeof scene>['p'], ...fs: { id: string }[]): void => { for (const f of fs) p.s.visible.add(idx(p.s.map, entOf(p, f.id)!.pos)); };

it('a turn standing: a foe in reach is struck, the turn lasts the blow, and the clone never steps by itself', () => {
  const { p, u, foes } = scene('warrior'); const [a, b] = foes; put(p, a!, 5, 4, 999); put(p, b!, 8, 4, 999); see(p, a!, b!);
  p.s.rng.chance = () => true; p.leader = u.id;
  const st = stats(u, 0, p);
  expect(autoHitTurn(p, u, 0, [])).toBe(Math.max(0.5, st.atk));
  expect(entOf(p, a!.id)!.hp).toBeLessThan(999);
  // the far one is left alone and nobody walks to it; with nothing in reach a turn standing is a short one
  expect(entOf(p, b!.id)!.hp).toBe(999); expect(entOf(p, u.id)!.pos).toEqual({ x: 4, y: 4 });
  entOf(p, a!.id)!.alive = false;
  expect(autoHitTurn(p, u, 2, [])).toBe(0.5);
});

it('a turn walking: the step, then the blow from where it then stands; any order but a walk is dropped', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 7, 4, 999); see(p, a!);
  p.s.rng.chance = () => true; p.leader = u.id;
  u.order = { kind: 'attack', target: a!.id };
  autoHitTurn(p, u, 0, []); expect(u.order).toBeNull(); expect(entOf(p, a!.id)!.hp).toBe(999);
  // two cells off: the first step reaches nothing, the second brings it beside the foe and the blow lands
  u.order = { kind: 'move', cell: { x: 6, y: 4 } };
  const st = stats(u, 1, p);
  expect(autoHitTurn(p, u, 1, [])).toBe(st.move);
  expect(entOf(p, u.id)!.pos).toEqual({ x: 5, y: 4 }); expect(entOf(p, a!.id)!.hp).toBe(999);
  expect(autoHitTurn(p, u, 2, [])).toBe(Math.max(st.move, st.atk));
  expect(entOf(p, u.id)!.pos).toEqual({ x: 6, y: 4 }); expect(entOf(p, a!.id)!.hp).toBeLessThan(999); expect(u.order).toBeNull();
});

it('in a fight the player\'s wait and walk are turns with their blow, and nothing is drunk or cast for the led clone', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4, 999); see(p, a!);
  p.s.rng.chance = () => true; p.leader = u.id; AUTOHIT.on = true;
  p.manual = u.id; p.waiting = true; p.combat = true;
  const ev = command(p, { kind: 'wait' });
  expect(entOf(p, a!.id)!.hp).toBeLessThan(999); expect(ev.some((e) => e.type === 'wait')).toBe(true);
  expect(u.nextAt).toBeGreaterThanOrEqual(p.time + stats(u, p.time, p).atk);
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
