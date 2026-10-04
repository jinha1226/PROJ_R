import { describe, expect, it } from 'vitest';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { freshMeta } from '../../../src/sim/grid/meta';
import { findPath } from '../../../src/sim/grid/path';
import { nextFloor } from '../../../src/sim/grid/run';
import { idx, same, tileAt, type Cell, type Room } from '../../../src/sim/grid/types';

const contains = (r: Room, p: Cell) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const centre = (r: Room) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });

describe('guaranteed first-floor melee weapon', () => {
  it.each([1, 6, 11] as const)('places a deterministic tier-1 melee in the farther half at start %s', (start) => {
    const groups = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const meta = freshMeta();
      meta.suit = { floor: start, ids: ['dash'], killer: { kind: 'brute' } };
      const options = { gun: 'pistol', start, startSuit: [] } as const;
      const create = () => GridSim.createRun(seed, meta, { ...options, startSuit: [] }).s;
      const s = create();
      const weapons = s.floorItems.filter(f => f.item.kind === 'weapon');
      expect(weapons, `seed ${seed}, start ${start}`).toHaveLength(1);
      const { pos, item } = weapons[0]!;
      expect(item.kind).toBe('weapon');
      if (item.kind !== 'weapon') throw new Error('missing weapon');
      expect(item.tier).toBe(1);
      expect(['dagger', 'sword', 'axe', 'spear', 'mace']).toContain(item.group);
      groups.add(item.group);
      const end = s.map.stairs ?? s.foes.find(f => f.kind === 'champion')?.pos;
      const rooms = s.map.rooms.filter(r => !contains(r, s.map.start) && (!end || !contains(r, end)))
        .map(r => ({ r, distance: findPath(s.map, s.map.start, centre(r))?.length ?? -1 }))
        .filter(r => r.distance >= 0).sort((a, b) => a.distance - b.distance);
      expect(rooms.slice(Math.floor(rooms.length / 2)).some(({ r }) => contains(r, pos))).toBe(true);
      expect(s.map.rooms.filter(r => contains(r, s.map.start)).some(r => contains(r, pos))).toBe(false);
      expect(tileAt(s.map, pos)).toBe('floor');
      expect(findPath(s.map, s.map.start, pos)).not.toBeNull();
      const occupied = [...s.foes.map(f => f.pos), ...s.chests.map(c => c.pos), ...s.barrels, ...s.traps.map(t => t.pos)];
      expect(occupied.some(p => same(p, pos))).toBe(false);
      expect(s.floorItems.filter(f => idx(s.map, f.pos) === idx(s.map, pos))).toHaveLength(1);
      expect(create().floorItems).toEqual(s.floorItems);
    }
    expect(groups.size).toBe(5);
  });

  it('does not repeat the guarantee after descending', () => {
    const s = GridSim.createRun(7, freshMeta(), { gun: 'pistol', start: 1, startSuit: [] }).s;
    expect(s.floorItems.some(f => f.item.kind === 'weapon')).toBe(true);
    nextFloor(s);
    expect(s.floorItems.some(f => f.item.kind === 'weapon')).toBe(false);
  });
});
