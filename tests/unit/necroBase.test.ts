import { expect, it } from 'vitest';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { BASE_CLASSES } from '../../src/sim/party/partyDefs';
import { corpsesNear } from '../../src/sim/party/corpses';
import { action } from '../../src/sim/party/triggers';
import { BRANCHES } from '../../src/sim/party/branches';
import type { GEvent } from '../../src/sim/grid/types';
import { necroScene } from './support/necroScene';


it('the necromancer is a base class with a staff and its three branches', () => {
  expect(BASE_CLASSES).toContain('necromancer');
  const { u } = necroScene();
  expect(u.cls).toBe('necromancer'); expect(u.weapon).toBe('staff');
  expect(BRANCHES.filter((b) => b.line === 'necromancer').map((b) => b.id)).toEqual(['necromancer:bone', 'necromancer:legion', 'necromancer:plague']);
});

it('corpse explosion: a kill bursts the body, hurting the foes beside it; a body that falls to the burst bursts too, each once', () => {
  const { p, u, put } = necroScene();
  p.s.rng.chance = () => false;
  const a = put(0, 9, 6, 40), b = put(1, 10, 6, 5), c = put(2, 11, 6, 999);
  const ev: GEvent[] = [];
  action(p, () => damage(p, 0, u.id, a, 999, ev, true));
  expect(entOf(p, b.id)!.alive).toBe(false);
  expect(entOf(p, c.id)!.hp).toBeLessThan(999);
  expect(ev.filter((e) => e.text === '시체 폭발').length).toBe(2);
  expect(corpsesNear(p, { x: 10, y: 6 }, 3)).toHaveLength(0);
});

it('call of the dead: a fifth of kills raise a skeleton from the body instead', () => {
  const { p, u, put } = necroScene();
  p.s.rng.chance = () => true;
  const a = put(0, 9, 6, 10);
  action(p, () => damage(p, 0, u.id, a, 99, [], true));
  expect(p.units.some((x) => x.summoner === u.id && entOf(p, x.id)?.alive)).toBe(true);
  expect(a.raised).toBe(true);
});
