import { expect, it } from 'vitest';
import { distanceMap } from '../../src/sim/grid/path';
import { idx } from '../../src/sim/grid/types';
import { DELVE_SIZE, generateFloor } from '../../src/sim/delve/delveGen';

it('a floor is 64 wide with 16–22 rooms, all reachable, with one vault, a den and ore', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const f = generateFloor(seed, 3);
    expect(f.map.w).toBe(DELVE_SIZE);
    expect(f.rooms.length).toBeGreaterThanOrEqual(16);
    expect(f.rooms.length).toBeLessThanOrEqual(22);
    const d = distanceMap(f.map, f.map.start);
    for (const r of f.rooms) expect(d[idx(f.map, { x: r.rect.x + (r.rect.w >> 1), y: r.rect.y + (r.rect.h >> 1) })]).toBeGreaterThanOrEqual(0);
    expect(f.rooms.filter((r) => r.kind === 'vault')).toHaveLength(1);
    expect(f.rooms.filter((r) => r.kind === 'den')).toHaveLength(1);
    expect(f.ore.length).toBeGreaterThanOrEqual(3);
    expect(f.chests.some((c) => c.tier === 3)).toBe(true);
  }
});

it('the same seed and floor build the same floor', () => {
  expect(generateFloor(9, 4)).toEqual(generateFloor(9, 4));
});

it('every fifth floor ends in the general\'s hall', () => {
  const f = generateFloor(2, 5);
  expect(f.boss).toBe(true);
  expect(f.rooms.some((r) => r.kind === 'boss')).toBe(true);
  expect(f.map.spawns.some((s) => s.kind === 'champion')).toBe(true);
  expect(generateFloor(2, 4).boss).toBe(false);
});

it('traps lie hidden in corridors', () => {
  const f = generateFloor(3, 2);
  expect(f.map.traps!.length).toBeGreaterThanOrEqual(2);
  expect(f.map.traps!.every((t) => !t.found)).toBe(true);
});

it('room roles, solid ore and bands preserve the final walking graph across seeds', () => {
  for (let seed = 0; seed < 30; seed++) for (const floor of [1, 3, 5]) {
    const f = generateFloor(seed, floor), m = f.map, d = distanceMap(m, m.start);
    expect(f.rooms[0]!.kind).toBe('start');
    const deepest = d[idx(m, m.stairs!)]!;
    const occupied = new Set<string>();
    for (const [i, room] of f.rooms.entries()) {
      const r = room.rect;
      expect(r.w).toBeGreaterThanOrEqual(5); expect(r.w).toBeLessThanOrEqual(11);
      expect(r.h).toBeGreaterThanOrEqual(5); expect(r.h).toBeLessThanOrEqual(11);
      const n = d[idx(m, { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) })]!;
      expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(deepest);
      for (const other of f.rooms.slice(i + 1)) {
        const b = other.rect;
        expect(r.x + r.w + 2 <= b.x || b.x + b.w + 2 <= r.x || r.y + r.h + 2 <= b.y || b.y + b.h + 2 <= r.y).toBe(true);
      }
      const band = m.spawns.filter((s) => s.group === i);
      if (['start', 'ore', 'shrine', 'stairs'].includes(room.kind)) expect(band).toHaveLength(0);
      if (room.kind === 'den') { expect(band.length).toBeGreaterThanOrEqual(4); expect(band.filter((s) => s.elite)).toHaveLength(2); }
      if (room.kind === 'crypt') { expect(band).toHaveLength(2); expect(band.filter((s) => s.elite)).toHaveLength(1); }
      if (room.kind === 'boss') expect(band.map((s) => s.kind)).toEqual(['champion', 'brute', 'brute']);
      if (room.kind === 'ore') {
        const ore = f.ore.filter((c) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h);
        expect(ore.length).toBeGreaterThanOrEqual(3); expect(ore.length).toBeLessThanOrEqual(5);
        for (const c of ore) { expect(m.tiles[idx(m, c)]).toBe('pillar'); expect(c.x === r.x || c.x === r.x + r.w - 1 || c.y === r.y || c.y === r.y + r.h - 1).toBe(true); }
      }
      for (const s of band) {
        expect(m.tiles[idx(m, s.pos)]).toBe('floor');
        expect(s.pos.x >= r.x && s.pos.x < r.x + r.w && s.pos.y >= r.y && s.pos.y < r.y + r.h).toBe(true);
        expect(occupied.has(`${s.pos.x}:${s.pos.y}`)).toBe(false); occupied.add(`${s.pos.x}:${s.pos.y}`);
      }
    }
    for (const offset of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]) expect(m.tiles[idx(m, { x: m.start.x + offset.x, y: m.start.y + offset.y })]).toBe('floor');
    for (const t of m.traps!) expect(f.rooms.some(({ rect: r }) => t.pos.x >= r.x && t.pos.x < r.x + r.w && t.pos.y >= r.y && t.pos.y < r.y + r.h)).toBe(false);
    if (floor >= 3) expect(m.traps!.some((t) => t.kind === 'alarm')).toBe(true);
  }
});
