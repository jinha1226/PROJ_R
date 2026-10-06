import { expect, it } from 'vitest';
import type { GridMap } from '../../src/sim/grid/types';
import { tapCell } from '../../src/ui/delve/tapCell';

// a 5×3 room: an ore pillar in the middle of the top row, a wall at the right end
const map = (): GridMap => ({ w: 5, h: 3, tiles: ['floor', 'floor', 'pillar', 'floor', 'wall', 'floor', 'floor', 'floor', 'floor', 'wall', 'floor', 'floor', 'floor', 'floor', 'wall'], rooms: [], start: { x: 0, y: 1 }, exits: [], chests: [], spawns: [], barrels: [] });

it('a tap on open floor goes there', () => {
  expect(tapCell(map(), { x: 0, y: 1 }, { x: 3, y: 2 }, () => true)).toEqual({ x: 3, y: 2 });
});

it('a tap on an ore vein goes to the nearest open cell beside it', () => {
  expect(tapCell(map(), { x: 0, y: 1 }, { x: 2, y: 0 }, () => true)).toEqual({ x: 1, y: 0 });
});

it('a taken cell beside it is skipped; off the map is nothing', () => {
  const free = (c: { x: number; y: number }) => !(c.x === 1 && c.y === 0) && !(c.x === 1 && c.y === 1);
  expect(tapCell(map(), { x: 0, y: 1 }, { x: 2, y: 0 }, free)).toEqual({ x: 2, y: 1 });
  expect(tapCell(map(), { x: 0, y: 1 }, { x: 9, y: 9 }, () => true)).toBeNull();
});
