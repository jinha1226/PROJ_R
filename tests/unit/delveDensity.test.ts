import { expect, it } from 'vitest';
import { delveSize, generateFloor } from '../../src/sim/delve/delveGen';
import { newDelve } from '../../src/sim/delve/delveSim';
import { entOf } from '../../src/sim/party/partyCore';

it('floors grow with depth: 64, 80, 96, 112 cells across', () => {
  expect([1, 2, 3, 5, 6, 9, 10, 15].map(delveSize)).toEqual([64, 64, 80, 80, 96, 96, 112, 112]);
  for (const f of [1, 4, 7, 12]) expect(generateFloor(3, f).map.w).toBe(delveSize(f));
});

it('normal rooms hold bigger bands deeper down, mostly fodder', () => {
  const band = (floor: number) => {
    const f = generateFloor(5, floor), normal = new Set(f.rooms.flatMap((r, g) => (r.kind === 'normal' ? [g] : [])));
    const per = new Map<number, number>();
    for (const s of f.map.spawns) if (normal.has(s.group)) per.set(s.group, (per.get(s.group) ?? 0) + 1);
    const sizes = [...per.values()], fodder = f.map.spawns.filter((s) => normal.has(s.group) && s.fodder).length;
    return { min: Math.min(...sizes), max: Math.max(...sizes), share: fodder / sizes.reduce((a, b) => a + b, 0) };
  };
  const shallow = band(1), mid = band(4), deep = band(12);
  expect(shallow.max).toBeLessThanOrEqual(5); expect(mid.min).toBeGreaterThanOrEqual(4); expect(deep.min).toBeGreaterThanOrEqual(9);
  expect(deep.share).toBeGreaterThan(0.45); expect(deep.share).toBeLessThan(0.75);
});

it('every spawn stands on its own floor cell, even in small rooms on deep floors', () => {
  for (const seed of [1, 2, 3, 4, 5]) for (const floor of [10, 15]) {
    const m = generateFloor(seed, floor).map, cells = m.spawns.map((s) => s.pos.y * m.w + s.pos.x);
    expect(new Set(cells).size).toBe(cells.length);
    for (const s of m.spawns) expect(m.tiles[s.pos.y * m.w + s.pos.x]).toBe('floor');
  }
});

it('fodder falls to a blow or two', () => {
  const p = newDelve(5, 3), f = p.units.find((u) => u.side === 'foe' && p.s.map.spawns.some((s) => s.fodder && entOf(p, u.id)!.pos.x === s.pos.x && entOf(p, u.id)!.pos.y === s.pos.y))!;
  expect(entOf(p, f.id)!.maxHp).toBeLessThanOrEqual(14);
});
