import { expect, it } from 'vitest';
import type { GridMap, GridState } from '../../src/sim/grid/types';
import { frontier } from '../../src/ui/delve/explore';

const state = (seenUpTo: number): GridState => {
  const map: GridMap = { w: 6, h: 1, tiles: Array(6).fill('floor'), rooms: [], start: { x: 0, y: 0 }, exits: [], chests: [], spawns: [], barrels: [] };
  return { map, seen: Uint8Array.from([0, 1, 2, 3, 4, 5].map((x) => (x <= seenUpTo ? 1 : 0))) } as unknown as GridState;
};

it('explore heads for the nearest seen cell next to the unknown', () => {
  expect(frontier(state(2), { x: 0, y: 0 })).toEqual({ x: 2, y: 0 });
});

it('nothing left to uncover, nowhere to go', () => {
  expect(frontier(state(5), { x: 0, y: 0 })).toBeNull();
});
