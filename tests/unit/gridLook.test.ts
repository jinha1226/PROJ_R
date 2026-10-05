import { describe, it, expect } from 'vitest';
import { torchSpots, wallFaces } from '../../src/view/grid/gridLayout';
import { generateMap } from '../../src/sim/grid/mapgen';
import { tileAt, walkable, type GridMap, type Tile } from '../../src/sim/grid/types';

const hand = (rows: string[]): GridMap => ({ w: rows[0]!.length, h: rows.length, tiles: rows.join('').split('').map((c) => (c === '#' ? 'wall' : 'floor') as Tile), rooms: [], start: { x: 1, y: 1 }, exits: [], chests: [], spawns: [] });

describe('grid look layout', () => {
  it('every wall side that faces a walkable tile gets a wall face, turned toward the floor', () => {
    const m = hand(['####', '#..#', '####']);
    const faces = wallFaces(m);
    expect(faces).toHaveLength(6);
    const left = faces.find((f) => f.wall.x === 0 && f.wall.y === 1)!;
    expect(left.floor).toEqual({ x: 1, y: 1 });
    expect(left.dir).toEqual({ x: 1, y: 0 });
  });

  it('torches hang on wall faces, spread at least four tiles apart', () => {
    const m = generateMap(7);
    const spots = torchSpots(m);
    expect(spots.length).toBeGreaterThan(8);
    for (const s of spots) {
      expect(tileAt(m, s.wall)).toBe('wall');
      expect(walkable(tileAt(m, s.floor))).toBe(true);
    }
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i]!.floor;
      const b = spots[j]!.floor;
      expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeGreaterThanOrEqual(4);
    }
    expect(torchSpots(m)).toEqual(spots);
  });
});
