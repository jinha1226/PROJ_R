import { afterEach, beforeEach, expect, it } from 'vitest';
import { action, emit } from '../../src/sim/party/triggers';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { gainXp, LEVEL_XP } from '../../src/sim/party/partyLevel';
import { learn, pointsLeft, raise, SKILLS, skillLine, skillName } from '../../src/sim/party/skills';
import { classScene } from './support/classScene';

beforeEach(() => { SKILLS.on = true; });
afterEach(() => { SKILLS.on = false; });

it('a level is a point: an element in an empty place, or a step up for one held; no card is offered', () => {
  const { p, u } = classScene('warrior');
  expect(pointsLeft(u)).toBe(1);
  expect(learn(p, u.id, 'hand', 'fire')).toBe(true);
  expect(pointsLeft(u)).toBe(0);
  expect(learn(p, u.id, 'body', 'none')).toBe(false);
  gainXp(p, u, LEVEL_XP[2]!, []);
  expect(u.level).toBe(3); expect(u.picks ?? 0).toBe(0); expect(u.offer).toBeUndefined();
  expect(pointsLeft(u)).toBe(2);
  // a place holds one skill: it is stepped up, never swapped
  expect(learn(p, u.id, 'hand', 'water')).toBe(false);
  expect(raise(p, u.id, 'hand')).toBe(true);
  expect(u.skills!.hand!.lv).toBe(2);
  expect(learn(p, u.id, 'body', 'none')).toBe(true);
  expect(pointsLeft(u)).toBe(0);
});

it('with the switch off the skills do nothing and levels offer cards as before', () => {
  SKILLS.on = false;
  const { p, u, put, hp } = classScene('warrior');
  u.skills = { body: { el: 'none', lv: 1 } };
  const f = put(0, 5, 6, 500);
  action(p, () => emit(p, 'struck', { t: 1, src: u, target: f, ev: [] }));
  expect(hp(f)).toBe(500);
  gainXp(p, u, LEVEL_XP[1]!, []);
  expect(u.picks).toBe(1);
});

it('the body gives a blow back to the one that struck, the eye to the one that missed; water slows, then freezes', () => {
  const { p, u, put, hp } = classScene('warrior');
  u.skills = { body: { el: 'water', lv: 1 }, eye: { el: 'none', lv: 1 } };
  const f = put(0, 5, 6, 500), g = put(1, 4, 7, 500);
  action(p, () => emit(p, 'struck', { t: 1, src: u, target: f, ev: [] }));
  expect(hp(f)).toBeLessThan(500); expect(hp(g)).toBe(500);
  expect(f.status.chill).toBeTruthy();
  // a foe already slowed freezes
  action(p, () => emit(p, 'struck', { t: 3, src: u, target: f, ev: [] }));
  expect(f.status.freeze).toBeTruthy();
  action(p, () => emit(p, 'dodge', { t: 4, src: u, target: g, ev: [] }));
  expect(hp(g)).toBeLessThan(500);
  // the eye's blow is the harder of the two (and the plain element harder still)
  expect(500 - hp(g)).toBeGreaterThan((500 - hp(f)) / 2);
});

it('the hand adds a blow on every third that lands; the heart bursts where a foe fell and burns those beside it', () => {
  const { p, u, put, hp } = classScene('warrior');
  u.skills = { hand: { el: 'none', lv: 1 }, heart: { el: 'fire', lv: 1 } };
  const a = put(0, 5, 6, 5000), far = put(1, 9, 6, 5000);
  const lost: number[] = [];
  for (let k = 0; k < 3; k++) { const before = hp(a); strike(p, u, a, 1 + k, []); lost.push(before - hp(a)); }
  expect(lost[2]).toBeGreaterThan(Math.max(lost[0]!, lost[1]!));
  // a kill beside `a`: the burst reaches it (one cell) and not the far foe
  const c = put(2, 5, 7, 1), before = hp(a);
  action(p, () => damage(p, 4, u.id, c, 99, [], true));
  expect(entOf(p, c.id)!.alive).toBe(false);
  expect(hp(a)).toBeLessThan(before); expect(hp(far)).toBe(5000);
  expect(a.status.burn).toBeTruthy();
});

it('the head bursts round the clone on a wait and the foot strikes those beside it on a second step, in a fight only', () => {
  const { p, u, put, hp } = classScene('warrior');
  u.skills = { head: { el: 'none', lv: 1 }, foot: { el: 'wood', lv: 1 } };
  // nobody about: nothing goes off (and the foot's count of steps does not run)
  action(p, () => emit(p, 'wait', { t: 1, src: u, ev: [] }));
  action(p, () => emit(p, 'moved', { t: 1, src: u, ev: [] }));
  const near = put(0, 5, 6, 500), two = put(1, 6, 6, 500), far = put(2, 9, 6, 500);
  action(p, () => emit(p, 'wait', { t: 3, src: u, ev: [] }));
  expect(hp(near)).toBeLessThan(500); expect(hp(two)).toBeLessThan(500); expect(hp(far)).toBe(500);
  const mid = hp(two);
  action(p, () => emit(p, 'moved', { t: 4, src: u, ev: [] }));
  expect(near.status.poison).toBeFalsy();
  action(p, () => emit(p, 'moved', { t: 5, src: u, ev: [] }));
  // the foot reaches one cell: the foe beside is poisoned and a cloud is left, the one two cells off is not touched
  expect(near.status.poison?.stacks).toBeGreaterThanOrEqual(2);
  expect((p.grounds ?? []).some((g) => g.kind === 'poison')).toBe(true);
  expect(hp(two)).toBe(mid);
});

it('a skill says what it does in a line, under a name the log and the strip use; bursts widen at the third step', () => {
  expect(skillName('eye', { el: 'fire', lv: 3 })).toBe('눈·화');
  expect(skillName('hand', { el: 'none', lv: 1 })).toBe('손·무');
  expect(skillLine('eye', { el: 'fire', lv: 3 })).toBe('피하면 빗나간 적을 받아친다 · 닿은 적과 그 옆이 불탄다');
  expect(skillLine('heart', { el: 'none', lv: 2 })).toBe('처치하면 그 자리 주변 1칸이 터진다');
  expect(skillLine('heart', { el: 'none', lv: 3 })).toBe('처치하면 그 자리 주변 2칸이 터진다');
});
