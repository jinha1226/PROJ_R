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

it('a turn walking: the blow from where it stands, so a step back still strikes; with nothing in reach, from where the step ends', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4, 999); see(p, a!);
  p.s.rng.chance = () => true; p.leader = u.id;
  const st = stats(u, 0, p);
  // beside the foe, a step away: struck, then gone
  u.order = { kind: 'move', cell: { x: 3, y: 4 } };
  expect(autoHitTurn(p, u, 0, [])).toBe(Math.max(st.move, st.atk));
  expect(entOf(p, u.id)!.pos).toEqual({ x: 3, y: 4 }); expect(entOf(p, a!.id)!.hp).toBeLessThan(999); expect(u.order).toBeNull();
  // two cells off now: a step toward it reaches it, and the blow lands from there (one blow a turn)
  const hp = entOf(p, a!.id)!.hp;
  u.order = { kind: 'move', cell: { x: 4, y: 4 } };
  autoHitTurn(p, u, 2, []);
  expect(entOf(p, u.id)!.pos).toEqual({ x: 4, y: 4 }); expect(entOf(p, a!.id)!.hp).toBeLessThan(hp);
  // a step with nothing in reach before or after is just a step
  put(p, a!, 12, 4, 999); u.order = { kind: 'move', cell: { x: 3, y: 4 } };
  expect(autoHitTurn(p, u, 4, [])).toBe(st.move); expect(entOf(p, a!.id)!.hp).toBe(999);
});

it('walking into a foe is a clash: it strikes, the clone strikes harder, and the cell is taken only if the foe falls', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4, 999); see(p, a!);
  p.s.rng.chance = () => true; p.s.rng.next = () => 0.5; p.leader = u.id;
  const me = entOf(p, u.id)!, full = me.hp;
  // a plain blow, for scale
  autoHitTurn(p, u, 0, []); const plain = 999 - entOf(p, a!.id)!.hp; put(p, a!, 5, 4, 999); me.hp = full;
  const ev: { type: string; text?: string }[] = [];
  u.order = { kind: 'attack', target: a!.id };
  autoHitTurn(p, u, 2, ev as never);
  expect(999 - entOf(p, a!.id)!.hp).toBeGreaterThan(plain); expect(me.hp).toBeLessThan(full);
  expect(ev.some((e) => e.text === '들이받기')).toBe(true);
  // it stands: the clone has not moved
  expect(me.pos).toEqual({ x: 4, y: 4 });
  // one that falls to it gives up its cell
  put(p, a!, 5, 4, 1); u.order = { kind: 'attack', target: a!.id };
  autoHitTurn(p, u, 4, []);
  expect(entOf(p, a!.id)!.alive).toBe(false); expect(me.pos).toEqual({ x: 5, y: 4 });
  // a foe that has not noticed strikes no blow back
  const [, b] = foes; put(p, b!, 6, 4, 999); b!.asleep = true; see(p, b!); const hp = me.hp;
  u.order = { kind: 'attack', target: b!.id }; autoHitTurn(p, u, 6, []);
  expect(me.hp).toBe(hp); expect(entOf(p, b!.id)!.hp).toBeLessThan(999);
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
