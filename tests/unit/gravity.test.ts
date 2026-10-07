import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { entOf, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { ultSlots, useUltimate } from '../../src/sim/party/ultimate';
import { GRAVITY_REACH, GRAVITY_TURNS, tickWells } from '../../src/sim/party/gravity';
import { aimNeeded } from '../../src/ui/delve/aim';
import { dist, idx, walkable, tileAt, type GEvent } from '../../src/sim/grid/types';

/** open floor around (10,6); the empty body at (4,6); foes placed by the test */
const field = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!;
  for (let y = 1; y < 12; y++) for (let x = 2; x < 18; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  entOf(p, 'hero')!.pos = { x: 4, y: 6 };
  const foes = p.units.filter((x) => x.side === 'foe');
  for (const f of foes) { entOf(p, f.id)!.alive = false; f.reaped = true; }
  const put = (k: number, x: number, y: number): Unit => {
    const f = foes[k]!, e = entOf(p, f.id)!;
    e.alive = true; e.hp = e.maxHp = 999; e.pos = { x, y }; f.asleep = false; f.reaped = false; f.nextAt = 999;
    return f;
  };
  return { p, u, put };
};

it('the empty body has the gravity grenade as its one ultimate, aimed', () => {
  const { u } = field();
  expect(ultSlots(u).map((s) => s.ult)).toEqual(['gravity']);
  expect(aimNeeded(u, 0)).toBe(true);
});

it('summoned bodies (skeletons share the shell class) get no gravity grenade', () => {
  const { p, u } = field();
  const skel = { ...u, id: 'skel', summoner: u.id, gear: undefined, weapon: 'fists' as const, souls: undefined };
  p.units.push(skel);
  expect(ultSlots(skel)).toEqual([]);
});

it('the well pulls foes within three cells a step toward it each half turn, never onto a wall or another body', () => {
  const { p, put } = field();
  const at = { x: 10, y: 6 };
  const foes = [put(0, 13, 6), put(1, 10, 9), put(2, 7, 6), put(3, 12, 8)];
  const before = foes.map((f) => dist(entOf(p, f.id)!.pos, at));
  expect(useUltimate(p, 'hero', at, 0).length).toBeGreaterThan(0);
  const ev: GEvent[] = [];
  for (let k = 1; k <= GRAVITY_TURNS * 2 - 1; k++) tickWells(p, p.time + k * 0.5, ev);
  const after = foes.map((f) => entOf(p, f.id)!.pos);
  after.forEach((c, i) => {
    expect(dist(c, at)).toBeLessThan(before[i]!);
    expect(walkable(tileAt(p.s.map, c))).toBe(true);
  });
  expect(new Set(after.map((c) => idx(p.s.map, c))).size).toBe(foes.length);
  expect(ev.some((e) => e.type === 'move' && e.text === 'pull')).toBe(true);
});

it('after two turns it collapses: everything within one cell takes damage once and is stunned; the well is gone', () => {
  const { p, put } = field();
  const at = { x: 10, y: 6 }, close = put(0, 11, 6), far = put(1, 10, GRAVITY_REACH + 6 + 2);
  useUltimate(p, 'hero', at, 0);
  const hp = entOf(p, close.id)!.hp, farHp = entOf(p, far.id)!.hp, ev: GEvent[] = [];
  tickWells(p, p.time + GRAVITY_TURNS, ev);
  expect(entOf(p, close.id)!.hp).toBeLessThan(hp);
  expect((close.status.stun?.until ?? 0) > p.time).toBe(true);
  expect(entOf(p, far.id)!.hp).toBe(farHp);
  expect(ev.some((e) => e.text === '중력 붕괴')).toBe(true);
  expect(p.wells ?? []).toHaveLength(0);
  const again = entOf(p, close.id)!.hp;
  tickWells(p, p.time + GRAVITY_TURNS + 1, []);
  expect(entOf(p, close.id)!.hp).toBe(again);
});

it('the grenade needs a foe near the chosen cell and the cell in reach', () => {
  const { p, put } = field();
  put(0, 16, 10);
  expect(useUltimate(p, 'hero', { x: 10, y: 2 }, 0)).toEqual([]);
});
