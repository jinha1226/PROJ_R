import { describe, it, expect } from 'vitest';
import { tileAt, walkable, canStep, idx, type GridMap, type Tile } from '../../../src/sim/grid/types';
import { generateMap } from '../../../src/sim/grid/mapgen';
import { computeFov, losClear } from '../../../src/sim/grid/fov';
import { findPath } from '../../../src/sim/grid/path';

/** A hand map from rows: '#' wall, '.' floor, 'P' pillar, '+' door. */
export function handMap(rows: string[]): GridMap {
  const ch: Record<string, Tile> = { '#': 'wall', '.': 'floor', P: 'pillar', '+': 'door' };
  return { w: rows[0]!.length, h: rows.length, tiles: rows.join('').split('').map((c) => ch[c]!), rooms: [], start: { x: 1, y: 1 }, exits: [], chests: [], spawns: [] };
}

describe('grid map generation', () => {
  it('makes a 48x48 floor with rooms, a start and two reachable exits', () => {
    const m = generateMap(7);
    expect(m.w).toBe(48);
    expect(m.h).toBe(48);
    expect(m.rooms.length).toBeGreaterThanOrEqual(8);
    expect(walkable(tileAt(m, m.start))).toBe(true);
    expect(m.exits).toHaveLength(2);
    for (const e of m.exits) {
      expect(walkable(tileAt(m, e))).toBe(true);
      expect(findPath(m, m.start, e)).not.toBeNull();
    }
  });

  it('puts chests and foes on floor, none in the start room', () => {
    const m = generateMap(11);
    const r0 = m.rooms[0]!;
    const inStart = (c: { x: number; y: number }) => c.x >= r0.x && c.x < r0.x + r0.w && c.y >= r0.y && c.y < r0.y + r0.h;
    expect(m.chests.length).toBeGreaterThan(0);
    expect(m.spawns.length).toBeGreaterThan(0);
    for (const c of m.chests) expect(tileAt(m, c)).toBe('floor');
    for (const s of m.spawns) {
      expect(tileAt(m, s.pos)).toBe('floor');
      expect(inStart(s.pos)).toBe(false);
    }
  });

  it('every seed gives enough rooms and two reachable exits', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const m = generateMap(seed);
      expect(m.rooms.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
      expect(m.exits.length, `seed ${seed}`).toBe(2);
      for (const e of m.exits) expect(findPath(m, m.start, e), `seed ${seed}`).not.toBeNull();
    }
  });

  it('is the same map for the same seed', () => {
    expect(generateMap(5).tiles).toEqual(generateMap(5).tiles);
    expect(generateMap(5).tiles).not.toEqual(generateMap(6).tiles);
  });
});

describe('grid sight and movement', () => {
  const room = handMap([
    '#########',
    '#.......#',
    '#...#...#',
    '#.......#',
    '#..P....#',
    '#.......#',
    '#########',
  ]);

  it('sees across the floor but not behind a wall', () => {
    const v = computeFov(room, { x: 2, y: 2 }, 8);
    expect(v.has(idx(room, { x: 7, y: 5 }))).toBe(true);
    expect(v.has(idx(room, { x: 4, y: 2 }))).toBe(true);
    expect(v.has(idx(room, { x: 6, y: 2 }))).toBe(false);
  });

  it('a pillar blocks a shot, open floor does not, nor does a closed corner squeeze', () => {
    expect(losClear(room, { x: 2, y: 2 }, { x: 2, y: 5 })).toBe(true);
    expect(losClear(room, { x: 1, y: 4 }, { x: 5, y: 4 })).toBe(false);
    const corner = handMap(['#####', '#.#.#', '##.##', '#####']);
    expect(losClear(corner, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(false);
    expect(losClear(handMap(['####', '#.##', '##.#', '####']), { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
  });

  it('cannot cut a wall corner diagonally', () => {
    expect(canStep(room, { x: 2, y: 2 }, { x: 1, y: -1 })).toBe(true);
    expect(canStep(room, { x: 3, y: 2 }, { x: 1, y: -1 })).toBe(false);
    expect(canStep(room, { x: 1, y: 1 }, { x: -1, y: 0 })).toBe(false);
  });

  it('finds a way around walls and none into a sealed cell', () => {
    const p = findPath(room, { x: 3, y: 2 }, { x: 5, y: 2 })!;
    expect(p[p.length - 1]).toEqual({ x: 5, y: 2 });
    expect(p.length).toBeGreaterThan(2);
    const sealed = handMap(['#####', '#.#.#', '#####']);
    expect(findPath(sealed, { x: 1, y: 1 }, { x: 3, y: 1 })).toBeNull();
  });
});
