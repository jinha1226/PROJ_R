import { expect, it } from 'vitest';
import { byItself, cheb, FEAR, foes, give, heroes, newSquad, resolve, setIntents, SHATTER, stance, standFor, unit, verdict, type Squad } from '../../src/sim/squad/squadSim';

/** a board with only the named foes left, each put where the test wants it */
const only = (s: Squad, keep: Record<string, [number, number]>): void => {
  for (const f of s.units.filter((u) => u.side === 'foe')) { const at = keep[f.id]; if (at) f.pos = { x: at[0], y: at[1] }; else f.alive = false; }
  setIntents(s);
};

it('the board: three of the party below the gap, five foes above it, every foe showing what it will do', () => {
  const s = newSquad();
  expect(heroes(s).map((u) => u.id)).toEqual(['me', 'misha', 'erwen']); expect(foes(s)).toHaveLength(5);
  expect(foes(s).every((f) => f.intent)).toBe(true);
  expect(unit(s, 'g1')!.intent).toMatchObject({ kind: 'chase' }); expect(unit(s, 'ar')!.intent).toMatchObject({ kind: 'shoot' }); expect(unit(s, 'og')!.intent).toEqual({ kind: 'walk' });
});

it('the order orders are given in is the order they are played in: frost first and the blade shatters, the blade first and it does not', () => {
  const a = newSquad(); only(a, { g1: [4, 6] });
  give(a, 'erwen', { kind: 'attack', target: 'g1' }); give(a, 'misha', { kind: 'attack', target: 'g1' });
  const ev = resolve(a);
  expect(ev.find((e) => e.type === 'hit' && e.src === 'misha')).toMatchObject({ amount: Math.round(4 * SHATTER), note: '깨뜨림' });
  expect(unit(a, 'g1')!.alive).toBe(false); expect(a.over).toBe('won');
  const b = newSquad(); only(b, { g1: [4, 6] });
  // (the leader is told to stand: left to himself he would finish it)
  give(b, 'misha', { kind: 'attack', target: 'g1' }); give(b, 'erwen', { kind: 'attack', target: 'g1' }); give(b, 'me', { kind: 'move', cell: { x: 4, y: 9 } });
  expect(resolve(b).find((e) => e.type === 'hit' && e.src === 'misha')).toMatchObject({ amount: 4 });
  expect(unit(b, 'g1')!.alive).toBe(true);
});

it('fear changes what a companion will do, and it is known before the order is given: afraid, it will not go by the ogre or among two; frozen, it hears nothing', () => {
  const s = newSquad(); only(s, { og: [4, 6], g1: [2, 6], g2: [1, 7] });
  const misha = unit(s, 'misha')!;
  expect(verdict(s, 'misha', { kind: 'attack', target: 'og' }).word).toBe('따름');
  misha.fear = FEAR.afraid; expect(stance(misha)).toBe('afraid');
  expect(verdict(s, 'misha', { kind: 'attack', target: 'og' })).toMatchObject({ word: '거부' });
  // (with the ogre gone, two goblins side by side are still too many)
  const t = newSquad(); only(t, { g1: [2, 6], g2: [2, 7] }); unit(t, 'misha')!.fear = FEAR.afraid;
  expect(verdict(t, 'misha', { kind: 'attack', target: 'g1' }).why).toMatch(/둘 이상/);
  expect(verdict(s, 'misha', { kind: 'move', cell: { x: 6, y: 9 } }).word).toBe('따름');
  // a refused order is not kept: left to itself, it backs away
  expect(give(s, 'misha', { kind: 'attack', target: 'og' }).word).toBe('거부'); expect(s.queue).toHaveLength(0);
  const away = byItself(s, misha)!; expect(away.kind).toBe('move');
  misha.fear = FEAR.frozen; expect(stance(misha)).toBe('frozen');
  expect(verdict(s, 'misha', { kind: 'move', cell: { x: 6, y: 9 } }).word).toBe('거부'); expect(byItself(s, misha)).toBeNull();
  // the leader is never afraid
  expect(verdict(s, 'me', { kind: 'attack', target: 'og' }).word).toBe('따름');
});

it('a frozen companion stays where the ogre will strike: the leader takes it for her, or she is talked round and walks out', () => {
  const start = () => { const s = newSquad(); only(s, { og: [3, 6] }); unit(s, 'misha')!.fear = FEAR.frozen; unit(s, 'og')!.winded = false; setIntents(s); return s; };
  const a = start();
  expect(unit(a, 'og')!.intent).toMatchObject({ kind: 'slam' });
  const hit = resolve(a).filter((e) => e.type === 'hit' && e.dst === 'misha');
  expect(hit).toHaveLength(1); expect(unit(a, 'misha')!.hp).toBe(16 - 9);
  // guarded: the blow lands on the leader, less the shield, and she takes heart
  const b = start(); give(b, 'me', { kind: 'guard', ally: 'misha' });
  const ev = resolve(b);
  expect(unit(b, 'misha')!.hp).toBe(16); expect(ev.some((e) => e.type === 'guard')).toBe(true);
  expect(ev.some((e) => e.type === 'feel' && e.id === 'misha' && e.why === '감싸 줬다')).toBe(true);
  // talked round: no longer frozen, she will move again
  const c = start(); give(c, 'me', { kind: 'calm', ally: 'misha' });
  resolve(c);
  expect(unit(c, 'misha')!.fear).toBeLessThan(FEAR.frozen);
});

it('a blow frightens (the timid one twice as much), a comrade down frightens more, a kill of her own steadies', () => {
  const s = newSquad(); only(s, { g1: [3, 7], g2: [5, 7] });
  unit(s, 'g1')!.intent = { kind: 'chase', target: 'misha' }; unit(s, 'g2')!.intent = { kind: 'chase', target: 'erwen' };
  give(s, 'me', { kind: 'move', cell: { x: 4, y: 9 } }); give(s, 'misha', { kind: 'move', cell: { x: 3, y: 8 } }); give(s, 'erwen', { kind: 'move', cell: { x: 5, y: 8 } });
  resolve(s);
  expect(unit(s, 'misha')!.fear).toBe(2); expect(unit(s, 'erwen')!.fear).toBe(1);
});

it('the stubborn one keeps to the foe she first shot at: told to shoot another, she shoots her own — and says so beforehand', () => {
  const s = newSquad(); only(s, { g1: [3, 6], g2: [5, 6] });
  give(s, 'erwen', { kind: 'attack', target: 'g1' }); give(s, 'me', { kind: 'move', cell: { x: 4, y: 8 } }); give(s, 'misha', { kind: 'move', cell: { x: 2, y: 9 } });
  resolve(s);
  expect(unit(s, 'erwen')!.lock).toBe('g1');
  const v = verdict(s, 'erwen', { kind: 'attack', target: 'g2' });
  expect(v.word).toBe('망설임'); expect(v.instead).toEqual({ kind: 'attack', target: 'g1' });
  give(s, 'erwen', { kind: 'attack', target: 'g2' }); expect(s.queue.at(-1)).toEqual({ id: 'erwen', order: { kind: 'attack', target: 'g1' } });
  expect(verdict(s, 'erwen', { kind: 'move', cell: { x: 6, y: 9 } }).word).toBe('따름');
});

it('the gap can be held: a goblin after someone behind the leader cannot get by, and strikes whoever stands in its way', () => {
  const s = newSquad(); only(s, { g1: [4, 3] });
  unit(s, 'misha')!.pos = { x: 5, y: 6 }; unit(s, 'me')!.pos = { x: 4, y: 6 }; unit(s, 'erwen')!.pos = { x: 4, y: 9 };
  unit(s, 'g1')!.intent = { kind: 'chase', target: 'erwen' };
  for (const id of ['me', 'misha', 'erwen']) give(s, id, { kind: 'move', cell: unit(s, id)!.pos });
  const ev = resolve(s);
  expect(unit(s, 'g1')!.pos.y).toBeLessThan(6);
  expect(ev.find((e) => e.type === 'hit' && e.src === 'g1')).toMatchObject({ note: '막아선 쪽' });
  expect(unit(s, 'erwen')!.hp).toBe(12);
});

it('walking: no one ends on another, a foe does not pass through the party, and what is out of reach is approached by the way round the wall', () => {
  const s = newSquad();
  const stand = standFor(s, unit(s, 'g1')!, unit(s, 'me')!.pos);
  expect(stand.inRange).toBe(false); expect(stand.path.length).toBeLessThanOrEqual(3);
  expect(cheb(stand.cell, { x: 4, y: 5 })).toBeLessThan(cheb(unit(s, 'g1')!.pos, { x: 4, y: 5 }));
});

it('left alone the fight plays itself to an end, one way or the other, with nothing rolled: the same board gives the same fight', () => {
  const play = () => { const s = newSquad(); let n = 0; while (!s.over && n++ < 40) resolve(s); return { over: s.over, round: s.round, hp: s.units.map((u) => u.hp).join(',') }; };
  const a = play(), b = play();
  expect(a.over).toBeDefined(); expect(a).toEqual(b);
});
