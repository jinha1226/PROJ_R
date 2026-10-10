import { afterEach, beforeEach, expect, it } from 'vitest';
import { action, emit } from '../../src/sim/party/triggers';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { gainXp, LEVEL_XP } from '../../src/sim/party/partyLevel';
import { learn, pointsLeft, raise, SKILLS, skillLine, skillName } from '../../src/sim/party/skills';
import type { GEvent } from '../../src/sim/grid/types';
import { classScene } from './support/classScene';

beforeEach(() => { SKILLS.on = true; });
afterEach(() => { SKILLS.on = false; });

it('a level is a point: a new skill in an empty place, or a step up for one held; no card is offered', () => {
  const { p, u } = classScene('warrior');
  expect(pointsLeft(u)).toBe(1);
  expect(learn(p, u.id, 'hand', 'emit', 'fire')).toBe(true);
  expect(pointsLeft(u)).toBe(0);
  expect(learn(p, u.id, 'body', 'forge', 'none')).toBe(false);
  gainXp(p, u, LEVEL_XP[2]!, []);
  expect(u.level).toBe(3); expect(u.picks ?? 0).toBe(0); expect(u.offer).toBeUndefined();
  expect(pointsLeft(u)).toBe(2);
  // a place holds one skill: it is stepped up, never swapped
  expect(learn(p, u.id, 'hand', 'bind', 'none')).toBe(false);
  expect(raise(p, u.id, 'hand')).toBe(true);
  expect(u.skills!.hand!.lv).toBe(2);
  expect(learn(p, u.id, 'body', 'forge', 'none')).toBe(true);
  expect(pointsLeft(u)).toBe(0);
});

it('with the switch off the skills do nothing and levels offer cards as before', () => {
  SKILLS.on = false;
  const { p, u, put } = classScene('warrior');
  u.skills = { body: { school: 'forge', el: 'none', lv: 1 } };
  const f = put(0, 5, 6, 50);
  action(p, () => emit(p, 'struck', { t: 1, src: u, target: f, ev: [] }));
  expect(u.shield).toBe(0);
  gainXp(p, u, LEVEL_XP[1]!, []);
  expect(u.picks).toBe(1);
});

it('the body answers a blow taken: a shield, and the one that struck is left the element', () => {
  const { p, u, put } = classScene('warrior');
  u.skills = { body: { school: 'forge', el: 'water', lv: 1 } };
  const f = put(0, 5, 6, 50);
  action(p, () => emit(p, 'struck', { t: 1, src: u, target: f, ev: [] }));
  expect(u.shield).toBe(5);
  expect(f.status.chill).toBeTruthy();
  // a foe already slowed freezes
  action(p, () => emit(p, 'struck', { t: 3, src: u, target: f, ev: [] }));
  expect(f.status.freeze).toBeTruthy();
});

it('the hand answers every third blow that lands, the heart every kill: the shot goes on to the nearest foe', () => {
  const { p, u, put } = classScene('warrior');
  u.skills = { hand: { school: 'emit', el: 'none', lv: 1 }, heart: { school: 'emit', el: 'fire', lv: 1 } };
  const a = put(0, 5, 6, 5000), b = put(1, 7, 6, 5000);
  const shotsIn = (ev: GEvent[]) => ev.filter((e) => e.type === 'shoot' && e.text === 'chain').length;
  const blows: GEvent[][] = [[], [], []];
  blows.forEach((ev, k) => strike(p, u, a, 1 + k, ev));
  expect(blows.map(shotsIn)).toEqual([0, 0, 1]);
  // a kill: the heart's shot flies on to the nearest foe left, and burns it
  const c = put(2, 5, 7, 1), ev: GEvent[] = [];
  action(p, () => damage(p, 4, u.id, c, 99, ev, true));
  expect(entOf(p, c.id)!.alive).toBe(false);
  expect(shotsIn(ev)).toBe(1);
  expect([a, b].some((f) => f.status.burn)).toBe(true);
});

it('the head answers a wait and the foot a second step, in a fight only', () => {
  const { p, u, put } = classScene('warrior');
  u.skills = { head: { school: 'bind', el: 'none', lv: 1 }, foot: { school: 'forge', el: 'none', lv: 1 } };
  // nobody about: nothing
  action(p, () => emit(p, 'wait', { t: 1, src: u, ev: [] }));
  action(p, () => emit(p, 'moved', { t: 1, src: u, ev: [] }));
  action(p, () => emit(p, 'moved', { t: 2, src: u, ev: [] }));
  expect(u.shield).toBe(0);
  const f = put(0, 5, 6, 50);
  action(p, () => emit(p, 'wait', { t: 3, src: u, ev: [] }));
  expect(f.status.stun).toBeTruthy();
  action(p, () => emit(p, 'moved', { t: 4, src: u, ev: [] }));
  expect(u.shield).toBe(0);
  action(p, () => emit(p, 'moved', { t: 5, src: u, ev: [] }));
  expect(u.shield).toBeGreaterThan(0);
});

it('the heart raises a helper where a foe fell, up to its cap; wood poisons and leaves a cloud', () => {
  const { p, u, put } = classScene('warrior');
  u.skills = { heart: { school: 'make', el: 'none', lv: 1 }, eye: { school: 'emit', el: 'wood', lv: 1 } };
  for (let k = 0; k < 3; k++) { const c = put(k, 5 + k, 7, 1); action(p, () => damage(p, 1 + k, u.id, c, 99, [], true)); }
  expect(p.units.filter((x) => x.summoner === u.id).length).toBe(2);
  const f = put(5, 5, 5, 500);
  action(p, () => emit(p, 'dodge', { t: 9, src: u, target: f, ev: [] }));
  expect(f.status.poison?.stacks).toBeGreaterThanOrEqual(2);
  expect((p.grounds ?? []).some((g) => g.kind === 'poison')).toBe(true);
});

it('a skill says what it does in a line, under a name the log and the strip use', () => {
  const s = { school: 'emit', el: 'fire', lv: 3 } as const;
  expect(skillName('eye', s)).toBe('눈 방출·화');
  expect(skillLine('eye', s)).toBe('피하면 가까운 적 2명에게 탄 · 닿은 적과 그 옆이 불탄다');
});
