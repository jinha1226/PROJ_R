import { expect, it } from 'vitest';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { BASE_CLASSES } from '../../src/sim/party/partyDefs';
import { corpsesNear } from '../../src/sim/party/corpses';
import { action, emit } from '../../src/sim/party/triggers';
import { BRANCHES } from '../../src/sim/party/branches';
import type { GEvent } from '../../src/sim/grid/types';
import { necroScene } from './support/necroScene';


it('the necromancer is a base class with a staff and its three branches', () => {
  expect(BASE_CLASSES).toContain('necromancer');
  const { u } = necroScene();
  expect(u.cls).toBe('necromancer'); expect(u.weapon).toBe('staff');
  expect(BRANCHES.filter((b) => b.line === 'necromancer').map((b) => b.id)).toEqual(['necromancer:bone', 'necromancer:legion', 'necromancer:plague']);
});

it('corpse explosion: a kill bursts the body for half its health on the foes beside it; a body that falls to the burst bursts too, each once', () => {
  const { p, u, put } = necroScene();
  const a = put(0, 9, 6, 40), b = put(1, 10, 6, 5), c = put(2, 11, 6, 999);
  const ev: GEvent[] = [];
  action(p, () => damage(p, 0, u.id, a, 999, ev, true));
  expect(entOf(p, b.id)!.alive).toBe(false);
  // b (5 health) burst on c for half of its own health; a's burst (20) does not reach two cells
  expect(999 - entOf(p, c.id)!.hp).toBe(3);
  expect(ev.filter((e) => e.text === '시체 폭발').length).toBe(2);
  expect(a.burst).toBe(true); expect(b.burst).toBe(true);
});

it('a burst body is still a body: it can be raised, and it does not burst twice', () => {
  const { p, u, put } = necroScene();
  const a = put(0, 9, 6, 40), near = put(1, 10, 6, 999);
  action(p, () => damage(p, 0, u.id, a, 999, [], true));
  expect(corpsesNear(p, { x: 9, y: 6 }, 0)).toEqual([a]);
  const hp = entOf(p, near.id)!.hp, ev: GEvent[] = [];
  action(p, () => emit(p, 'kill', { t: 1, src: u, target: a, ev }));
  expect(entOf(p, near.id)!.hp).toBe(hp); expect(ev.some((e) => e.text === '시체 폭발')).toBe(false);
});

it('no call of the dead: a necromancer without the legion card raises nothing from its kills', () => {
  const { p, u, put } = necroScene();
  for (let k = 0; k < 6; k++) action(p, () => damage(p, k, u.id, put(k, 9 + k % 3, 6, 10), 99, [], true));
  expect(p.units.some((x) => x.summoner === u.id)).toBe(false);
});
