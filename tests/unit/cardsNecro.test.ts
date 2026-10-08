import { expect, it } from 'vitest';
import { damage, entOf, stepToward, strike, type Unit } from '../../src/sim/party/partyCore';
import { action, emit } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { ultSlots, useUltimate } from '../../src/sim/party/ultimate';
import { corpsesNear } from '../../src/sim/party/corpses';
import { tickGrounds } from '../../src/sim/delve/catalogEffects';
import { necroScene } from './support/necroScene';
import type { GEvent } from '../../src/sim/grid/types';

const hp = (p: ReturnType<typeof necroScene>['p'], f: Unit) => entOf(p, f.id)!.hp;
const minions = (p: ReturnType<typeof necroScene>['p'], id: string) => p.units.filter((x) => x.summoner === id && entOf(p, x.id)?.alive);
const turn = (p: ReturnType<typeof necroScene>['p'], u: Unit, t: number) => action(p, () => emit(p, 'turn', { t, src: u, ev: [] }));
const kill = (s: ReturnType<typeof necroScene>, f: Unit) => { action(s.p, () => damage(s.p, 0, s.u.id, f, 9999, [], true)); };

it('twelve necromancer cards in three branches, a signature each; the golem is its ultimate', () => {
  const cards = Object.values(TRAITS).filter((d) => d.pool === 'necromancer');
  expect(cards).toHaveLength(12);
  for (const b of ['necromancer:bone', 'necromancer:legion', 'necromancer:plague']) expect(cards.filter((d) => d.branch === b && d.sig)).toHaveLength(1);
  expect(ultSlots(necroScene().u).map((s) => s.ult)).toEqual(['golem']);
});

it('bone spear: every third blow sends a bone spear through every foe in line (hits); every second once upgraded', () => {
  const s = necroScene(); s.u.traits = { boneSpear: 1 };
  const a = s.put(0, 7, 6), b = s.put(1, 9, 6), c = s.put(2, 11, 6);
  strike(s.p, s.u, a, 0, []); strike(s.p, s.u, a, 1, []);
  expect(hp(s.p, b)).toBe(999); expect(hp(s.p, c)).toBe(999);
  strike(s.p, s.u, a, 2, []);
  expect(hp(s.p, b)).toBeLessThan(999); expect(hp(s.p, c)).toBeLessThan(999);
  const up = necroScene(); up.u.traits = { boneSpear: 2 };
  const d = up.put(0, 7, 6), e = up.put(1, 9, 6);
  strike(up.p, up.u, d, 0, []); expect(hp(up.p, e)).toBe(999);
  strike(up.p, up.u, d, 1, []); expect(hp(up.p, e)).toBeLessThan(999);
});

it('raise skeleton: two skeletons stand up as the fight opens, between the necromancer and the foe, with no body about', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 }; s.put(8, 11, 6);
  action(s.p, () => emit(s.p, 'combatStart', { t: 0, src: s.u, ev: [] }));
  const sk = minions(s.p, s.u.id);
  expect(sk).toHaveLength(2);
  // the necromancer stands at (4,6), the foe to its right
  for (const m of sk) expect(entOf(s.p, m.id)!.pos.x).toBeGreaterThanOrEqual(4);
});

it('raise skeleton: a burst body within three still gives a skeleton each turn, up to three', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 }; s.put(8, 11, 10);
  // the kills burst the bodies (the innate); they are raised all the same
  for (let k = 0; k < 4; k++) { const f = s.put(k, 3 + k, 8, 1); kill(s, f); expect(f.burst).toBe(true); }
  for (let t = 1; t <= 5; t++) turn(s.p, s.u, t);
  expect(minions(s.p, s.u.id)).toHaveLength(3);
  expect(s.p.units.filter((f) => f.side === 'foe' && f.raised && f.burst)).toHaveLength(3);
});

it('raise skeleton: waiting in a fight raises one more with no body; out of a fight it does not', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 };
  action(s.p, () => emit(s.p, 'wait', { t: 0, src: s.u, ev: [] }));
  expect(minions(s.p, s.u.id)).toHaveLength(0);
  s.put(8, 10, 6);
  for (let t = 1; t <= 5; t++) action(s.p, () => emit(s.p, 'wait', { t, src: s.u, ev: [] }));
  expect(minions(s.p, s.u.id)).toHaveLength(3);
});

it('raise skeleton upgraded: three at the fight\'s start, five in all with archers among them', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 2 }; s.put(8, 11, 6);
  action(s.p, () => emit(s.p, 'combatStart', { t: 0, src: s.u, ev: [] }));
  expect(minions(s.p, s.u.id)).toHaveLength(3);
  for (let t = 1; t <= 4; t++) action(s.p, () => emit(s.p, 'wait', { t, src: s.u, ev: [] }));
  const sk = minions(s.p, s.u.id);
  expect(sk).toHaveLength(5); expect(sk.some((m) => m.weapon === 'longbow')).toBe(true);
});

it('a minion\'s kill is its master\'s kill: the body bursts on the foes beside it', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 }; s.put(8, 11, 10);
  action(s.p, () => emit(s.p, 'combatStart', { t: 0, src: s.u, ev: [] }));
  const sk = minions(s.p, s.u.id)[0]!, a = s.put(0, 9, 6, 40), b = s.put(1, 10, 6, 999);
  action(s.p, () => damage(s.p, 1, sk.id, a, 999, []));
  expect(a.burst).toBe(true); expect(999 - hp(s.p, b)).toBeGreaterThanOrEqual(20);
});

it('raise skeleton: a kill stands the body up where it fell, at once (the body bursts first)', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 }; s.put(8, 11, 10);
  const a = s.put(0, 9, 6, 1); kill(s, a);
  const sk = minions(s.p, s.u.id);
  expect(sk).toHaveLength(1); expect(entOf(s.p, sk[0]!.id)!.pos).toEqual({ x: 9, y: 6 });
  expect(a.burst).toBe(true); expect(a.raised).toBe(true);
});

it('raise skeleton: a skeleton strikes as it rises when a foe is in its reach', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 }; s.p.s.rng.chance = () => true;
  const a = s.put(0, 9, 6, 2), b = s.put(1, 10, 6, 999), ev: GEvent[] = [];
  action(s.p, () => damage(s.p, 0, s.u.id, a, 9999, ev, true));
  const sk = minions(s.p, s.u.id)[0]!;
  // the burst (half of 2) and then the skeleton's own blow
  expect(999 - hp(s.p, b)).toBeGreaterThan(1);
  expect(ev.some((e) => e.type === 'bump' && e.src === sk.id && e.dst === b.id)).toBe(true);
});

it('raise skeleton: with the legion full, a kill sends the oldest skeleton to blow itself up on the nearest foe, and the body rises in its place', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 }; const far = s.put(8, 9, 6, 999);
  for (let t = 0; t < 3; t++) action(s.p, () => emit(s.p, 'wait', { t, src: s.u, ev: [] }));
  const before = minions(s.p, s.u.id), oldest = before[0]!;
  expect(before).toHaveLength(3);
  const ev: GEvent[] = [];
  action(s.p, () => damage(s.p, 3, s.u.id, s.put(0, 3, 9, 1), 99, ev, true));
  const after = minions(s.p, s.u.id);
  expect(after).toHaveLength(3); expect(after).not.toContain(oldest); expect(oldest.burst).toBe(true);
  expect(ev.some((e) => e.text === '해골 자폭')).toBe(true);
  // it ran beside the foe and its burst reached it
  expect(hp(s.p, far)).toBeLessThan(999);
  expect(after.some((m) => entOf(s.p, m.id)!.pos.x === 3 && entOf(s.p, m.id)!.pos.y === 9)).toBe(true);
});

it('raise skeleton at rank three: a skeleton that blew itself up does not burst a second time', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 3 }; const far = s.put(8, 9, 6, 999);
  for (let t = 0; t < 5; t++) action(s.p, () => emit(s.p, 'wait', { t, src: s.u, ev: [] }));
  expect(minions(s.p, s.u.id)).toHaveLength(5);
  const ev: GEvent[] = [];
  action(s.p, () => damage(s.p, 6, s.u.id, s.put(0, 3, 9, 1), 99, ev, true));
  expect(ev.filter((e) => e.type === 'hit' && e.dst === far.id)).toHaveLength(1);
});

it('grasp of the dead: a fallen minion leaves two bodies', () => {
  const s = necroScene(); s.u.traits = { deadGrasp: 1, raiseSkeleton: 1 }; s.put(8, 11, 10);
  action(s.p, () => emit(s.p, 'wait', { t: 0, src: s.u, ev: [] }));
  const sk = minions(s.p, s.u.id)[0]!, at = { ...entOf(s.p, sk.id)!.pos };
  action(s.p, () => damage(s.p, 2, 'trap', sk, 999, []));
  expect(corpsesNear(s.p, at, 0)).toHaveLength(2);
});

it('soul link: a third of the harm the necromancer takes goes to the nearest minion', () => {
  const s = necroScene(); s.u.traits = { soulLink: 1, raiseSkeleton: 1 }; s.put(8, 11, 10);
  action(s.p, () => emit(s.p, 'wait', { t: 0, src: s.u, ev: [] }));
  const sk = minions(s.p, s.u.id)[0]!, e = entOf(s.p, 'hero')!; e.hp = e.maxHp = 1000; s.u.gear!.armor = null;
  const skHp = entOf(s.p, sk.id)!.hp;
  damage(s.p, 3, 'trap', s.u, 30, [], true);
  expect(1000 - e.hp).toBe(21); expect(skHp - entOf(s.p, sk.id)!.hp).toBe(9);
});

it('poison nova: a kill leaves a poison cloud that poisons foes within two each turn', () => {
  const s = necroScene(); s.u.traits = { poisonNova: 1 };
  const a = s.put(0, 8, 6, 1), b = s.put(1, 9, 7);
  kill(s, a);
  tickGrounds(s.p, 1.5, []);
  expect((b.status.poison?.until ?? 0) > 1).toBe(true);
});

it('curse: a hit curses the foe (it takes a fifth more)', () => {
  const s = necroScene(); s.u.traits = { curse: 1 };
  const a = s.put(0, 8, 6, 1000);
  action(s.p, () => emit(s.p, 'hit', { t: 0, src: s.u, target: a, ev: [] }));
  action(s.p, () => damage(s.p, 0.5, s.u.id, a, 100, [], true));
  expect(1000 - hp(s.p, a)).toBe(120);
});

it('poison burst: five stacks of poison burst at once and spread two to the neighbours', () => {
  const s = necroScene(); s.u.traits = { poisonBurst: 1 };
  const a = s.put(0, 8, 6), b = s.put(1, 9, 6);
  const ev: GEvent[] = [];
  action(s.p, () => applyStatus(s.p, s.u, a, 'poison', 0, ev, 5));
  expect(hp(s.p, a)).toBeLessThan(999); expect(a.status.poison).toBeUndefined();
  expect(b.status.poison?.stacks).toBe(2);
});

it('golem: gathers the bodies near the cell into one big minion that draws foes, and bursts when it falls', () => {
  const s = necroScene();
  expect(useUltimate(s.p, 'hero', { x: 10, y: 6 }, 0)).toEqual([]);
  // the bodies burst as they fall; the golem is made of them all the same
  for (let k = 0; k < 3; k++) kill(s, s.put(k, 9 + k, 6, 1));
  const foe = s.put(4, 12, 8);
  expect(useUltimate(s.p, 'hero', { x: 10, y: 6 }, 0).length).toBeGreaterThan(0);
  const g = minions(s.p, s.u.id).find((x) => x.golem)!;
  expect(entOf(s.p, g.id)!.maxHp).toBeGreaterThan(80);
  expect(foe.tauntBy).toBe(g.id);
  const h = hp(s.p, foe);
  action(s.p, () => damage(s.p, 1, foe.id, g, 99999, []));
  expect(hp(s.p, foe)).toBeLessThan(h);
});

it('out of a fight the necromancer walks through its own summon (they swap places); in a fight the summon stands in the way', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 }; const foe = s.put(8, 10, 6);
  action(s.p, () => emit(s.p, 'wait', { t: 0, src: s.u, ev: [] }));
  const sk = minions(s.p, s.u.id)[0]!, at = { ...entOf(s.p, sk.id)!.pos }, from = { ...entOf(s.p, 'hero')!.pos };
  s.p.combat = true;
  expect(stepToward(s.p, s.u, at, 1, [])).toBe(false);
  entOf(s.p, foe.id)!.alive = false; s.p.combat = false;
  expect(stepToward(s.p, s.u, at, 2, [])).toBe(true);
  expect(entOf(s.p, 'hero')!.pos).toEqual(at); expect(entOf(s.p, sk.id)!.pos).toEqual(from);
});
