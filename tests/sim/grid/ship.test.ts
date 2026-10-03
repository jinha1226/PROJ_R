import { expect, it } from 'vitest';
import { shipState, STATIONS } from '../../../src/sim/grid/ship';
import { freshMeta } from '../../../src/sim/grid/meta';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { walkBlocked } from '../../../src/sim/grid/actions';
import { findPath } from '../../../src/sim/grid/path';
import { same, tileAt } from '../../../src/sim/grid/types';
it('builds a deterministic empty deck with each reachable station once and starts at the pod', () => {
  const s = shipState(freshMeta());
  expect(s.mode).toBe('ship');
  expect(s.map.tiles).toHaveLength(19 * 13);
  expect(s.map.stations?.map(p => p.id).sort()).toEqual(Object.keys(STATIONS).sort());
  expect(s.hero.pos).toEqual(s.map.stations!.find(p => p.id === 'pod')!.pos);
  for (const p of s.map.stations!) {
    expect(tileAt(s.map, p.pos)).toBe('floor');
    expect(findPath(s.map, s.hero.pos, p.pos, c => walkBlocked(s, c))).not.toBeNull();
    expect(walkBlocked(s, p.pos)).toBe(true);
  }
  for (const list of [s.foes, s.traps, s.chests, s.barrels, s.floorItems, s.map.spawns, s.map.exits]) expect(list).toEqual([]);
  expect(shipState(freshMeta()).map).toEqual(s.map);
});
it('bumps every station without moving or advancing time; walks safely indefinitely', () => {
  const sim = GridSim.fromState(shipState(freshMeta()));
  for (const p of sim.s.map.stations!) {
    sim.s.hero.pos = { x: p.pos.x, y: p.pos.y + 1 };
    const before = { ...sim.s.hero.pos };
    expect(sim.act({ kind: 'move', dir: { x: 0, y: -1 } })).toContainEqual({ t: 0, type: 'station', src: 'hero', text: p.id, to: p.pos });
    expect(sim.s.hero.pos).toEqual(before);
    expect(sim.s.time).toBe(0);
  }
  sim.s.hero.pos = { x: 5, y: 5 };
  for (let i = 0; i < 100; i++) sim.act({ kind: 'move', dir: { x: i % 2 ? -1 : 1, y: 0 } });
  expect(same(sim.s.hero.pos, { x: 5, y: 5 })).toBe(true);
  expect(sim.s.foes).toEqual([]);
  expect(sim.s.time).toBe(0);
  expect(sim.act({ kind: 'search' })).toEqual([]);
});
