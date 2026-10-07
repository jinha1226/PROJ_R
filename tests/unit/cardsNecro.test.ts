import { expect, it } from 'vitest';
import { damage, entOf, strike, type Unit } from '../../src/sim/party/partyCore';
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
const kill = (s: ReturnType<typeof necroScene>, f: Unit) => { s.p.s.rng.chance = () => false; action(s.p, () => damage(s.p, 0, s.u.id, f, 9999, [], true)); };

it('twelve necromancer cards in three branches, a signature each; the golem is its ultimate', () => {
  const cards = Object.values(TRAITS).filter((d) => d.pool === 'necromancer');
  expect(cards).toHaveLength(12);
  for (const b of ['necromancer:bone', 'necromancer:legion', 'necromancer:plague']) expect(cards.filter((d) => d.branch === b && d.sig)).toHaveLength(1);
  expect(ultSlots(necroScene().u).map((s) => s.ult)).toEqual(['golem']);
});

it('bone spear: a third of blows send a bone spear through every foe in line (hits)', () => {
  const s = necroScene(); s.u.traits = { boneSpear: 1 }; s.p.s.rng.chance = () => true;
  const a = s.put(0, 7, 6), b = s.put(1, 9, 6), c = s.put(2, 11, 6);
  strike(s.p, s.u, a, 0, []);
  expect(hp(s.p, b)).toBeLessThan(999); expect(hp(s.p, c)).toBeLessThan(999);
});

it('raise skeleton: with a body within three a skeleton rises every turn, up to three', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 };
  for (let k = 0; k < 4; k++) { const f = s.put(k, 3 + k, 8, 1); kill(s, f); f.raised = false; }
  for (const f of s.p.units.filter((x) => x.side === 'foe')) if (!entOf(s.p, f.id)!.alive) f.raised = false;
  for (let t = 1; t <= 5; t++) turn(s.p, s.u, t);
  expect(minions(s.p, s.u.id)).toHaveLength(3);
});

it('grasp of the dead: a fallen minion leaves two bodies', () => {
  const s = necroScene(); s.u.traits = { deadGrasp: 1, raiseSkeleton: 1 };
  const f = s.put(0, 6, 6, 1); kill(s, f); f.raised = false;
  turn(s.p, s.u, 1);
  const sk = minions(s.p, s.u.id)[0]!, at = { ...entOf(s.p, sk.id)!.pos };
  action(s.p, () => damage(s.p, 2, 'trap', sk, 999, []));
  expect(corpsesNear(s.p, at, 0)).toHaveLength(2);
});

it('soul link: a third of the harm the necromancer takes goes to the nearest minion', () => {
  const s = necroScene(); s.u.traits = { soulLink: 1, raiseSkeleton: 1 };
  const f = s.put(0, 5, 6, 1); kill(s, f); f.raised = false; turn(s.p, s.u, 1);
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
  for (let k = 0; k < 3; k++) { const f = s.put(k, 9 + k, 6, 1); kill(s, f); f.raised = false; }
  const foe = s.put(4, 12, 8);
  expect(useUltimate(s.p, 'hero', { x: 10, y: 6 }, 0).length).toBeGreaterThan(0);
  const g = minions(s.p, s.u.id).find((x) => x.golem)!;
  expect(entOf(s.p, g.id)!.maxHp).toBeGreaterThan(80);
  expect(foe.tauntBy).toBe(g.id);
  const h = hp(s.p, foe);
  action(s.p, () => damage(s.p, 1, foe.id, g, 99999, []));
  expect(hp(s.p, foe)).toBeLessThan(h);
});
