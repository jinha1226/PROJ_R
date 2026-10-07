import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { damage, entOf, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { BASE_CLASSES } from '../../src/sim/party/partyDefs';
import { implant } from '../../src/sim/roam/roam';
import { corpsesNear } from '../../src/sim/party/corpses';
import { action } from '../../src/sim/party/triggers';
import { BRANCHES } from '../../src/sim/party/branches';
import type { GEvent } from '../../src/sim/grid/types';

export const necroScene = (seed = 4) => {
  const p = newDelve(seed, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 2; y < 12; y++) for (let x = 2; x < 18; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 4, y: 6 };
  implant(p, u, 'necromancer', []);
  const foes = p.units.filter((x) => x.side === 'foe');
  for (const f of foes) { entOf(p, f.id)!.alive = false; f.reaped = true; f.raised = true; }
  const put = (k: number, x: number, y: number, hp = 999): Unit => {
    const f = foes[k]!, e = entOf(p, f.id)!;
    e.alive = true; e.hp = e.maxHp = hp; e.pos = { x, y }; f.asleep = false; f.reaped = false; f.raised = false; f.nextAt = 999;
    return f;
  };
  return { p, u, put };
};

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
