import { expect, it } from 'vitest';
import type { GridMap, GridState } from '../../src/sim/grid/types';
import { AutoExplore, frontier } from '../../src/ui/delve/explore';

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

it('explore goes for a thing to pick up before the unknown, and beside it when it cannot be stood on', () => {
  const s = state(2), x = new AutoExplore(), went: { x: number; y: number }[] = [];
  s.map.tiles[4] = 'wall';
  x.start();
  x.step(s, { x: 0, y: 0 }, false, false, (c) => went.push(c), () => {}, [{ x: 4, y: 0 }]);
  expect(went).toEqual([{ x: 3, y: 0 }]);
  x.step(s, { x: 0, y: 0 }, false, false, (c) => went.push(c), () => {}, [{ x: 1, y: 0 }]);
  expect(went[1]).toEqual({ x: 1, y: 0 });
});

it('a thing reached but not taken (a full pack) is not walked back to again', () => {
  const s = state(5), x = new AutoExplore(), went: { x: number; y: number }[] = [], said: string[] = [];
  x.start();
  x.step(s, { x: 2, y: 0 }, false, false, (c) => went.push(c), (t) => said.push(t), [{ x: 2, y: 0 }]);
  x.step(s, { x: 3, y: 0 }, false, false, (c) => went.push(c), (t) => said.push(t), [{ x: 2, y: 0 }]);
  expect(went).toEqual([]); expect(said).toEqual(['더 갈 곳 없음']);
});

it('explore wants souls and items in sight, and chests seen but shut while the pack has room', async () => {
  const { newDelve } = await import('../../src/sim/delve/delveSim');
  const { exploreWants } = await import('../../src/ui/delve/explore');
  const { idx } = await import('../../src/sim/grid/types');
  const p = newDelve(5);
  const m = p.s.map, at = (c: { x: number; y: number }) => idx(m, c);
  p.souls = [{ id: 1, cls: 'mage', pos: { x: 3, y: 3 }, taken: false }];
  p.floorItems = [{ pos: { x: 4, y: 4 }, item: p.pack[0]! }, { pos: { x: 9, y: 9 }, item: p.pack[0]! }];
  p.chests = [{ pos: { x: 6, y: 6 }, tier: 1, opened: false } as never];
  p.s.visible = new Set([at({ x: 3, y: 3 }), at({ x: 4, y: 4 })]); p.s.seen[at({ x: 6, y: 6 })] = 1;
  expect(exploreWants(p)).toEqual([{ x: 3, y: 3 }, { x: 4, y: 4 }, { x: 6, y: 6 }]);
  p.pack = Array(16).fill(p.pack[0]!);
  expect(exploreWants(p)).toEqual([{ x: 3, y: 3 }]);
});
