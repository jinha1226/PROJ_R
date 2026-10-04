import type { Rng } from '../../core/rng';
import { distanceMap } from './path';
import { add, idx, inBounds, tileAt, type Cell, type GridMap, type Room } from './types';
export interface ToolSpot { kind: 'seal' | 'chasm' | 'hidden'; pos: Cell; room: Room; reward: Cell; n: number }
const CARDINAL: Cell[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
/** Carve only solid rock, leaving a wall ring and a single tool entrance. Ordinary rooms never change. */
export function placeToolSpots(m: GridMap, rng: Rng): void {
  const baseline = distanceMap(m, m.start);
  m.toolSpots = []; m.hidden = [];
  for (const kind of ['seal', 'chasm', 'hidden'] as const) {
    const candidates: { pos: Cell; room: Room }[] = [];
    for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
      const pos = { x, y };
      if (tileAt(m, pos) !== 'wall') continue;
      for (const d of CARDINAL) {
        const entrance = { x: x - d.x, y: y - d.y };
        if (tileAt(m, entrance) !== 'floor' || baseline[idx(m, entrance)]! < 0) continue;
        if (m.chests.some(c => c.x === entrance.x && c.y === entrance.y) || m.barrels?.some(c => c.x === entrance.x && c.y === entrance.y)) continue;
        const near = add(pos, d);
        const room: Room = { x: d.x === 1 ? near.x : d.x === -1 ? near.x - 2 : near.x - 1,
          y: d.y === 1 ? near.y : d.y === -1 ? near.y - 2 : near.y - 1, w: 3, h: 3 };
        let solid = true;
        for (let ry = room.y - 1; ry <= room.y + room.h; ry++) for (let rx = room.x - 1; rx <= room.x + room.w; rx++) {
          const c = { x: rx, y: ry };
          if (!inBounds(m, c) || tileAt(m, c) !== 'wall' || m.hidden.some(h => h.x === rx && h.y === ry)) solid = false;
        }
        if (solid) candidates.push({ pos, room });
      }
    }
    if (!candidates.length) continue;
    const { pos, room } = rng.pick(candidates);
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) m.tiles[idx(m, { x, y })] = 'floor';
    m.tiles[idx(m, pos)] = kind === 'hidden' ? 'wall' : kind;
    // A flood fill guards the invariant even if the candidate geometry changes later.
    const after = distanceMap(m, m.start);
    const reward = { x: room.x + 1, y: room.y + 1 };
    if (baseline.some((d, k) => d >= 0 && after[k]! < 0) || after[idx(m, reward)] !== -1) {
      for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) m.tiles[idx(m, { x, y })] = 'wall';
      m.tiles[idx(m, pos)] = 'wall'; continue;
    }
    if (kind === 'hidden') m.hidden.push(pos);
    m.toolSpots.push({ kind, pos, room, reward, n: rng.int(3, 4) });
    if (rng.chance(0.5)) m.chests.push({ x: room.x, y: room.y });
  }
}
