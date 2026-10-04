import { createRng } from '../../core/rng';
import { makeWeapon } from './items';
import { distanceMap } from './path';
import { idx, same, tileAt, type Cell, type GridState, type Room } from './types';

const contains = (r: Room, p: Cell): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const centre = (r: Room): Cell => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });

/** One local weapon on the run's starting floor; independent of combat and loot dice. */
export function placeFirstMelee(s: GridState): void {
  const rng = createRng((s.seed ^ 0x6d656c65) + s.run.floor * 7919);
  const d = distanceMap(s.map, s.map.start);
  const end = s.map.stairs ?? s.foes.find(f => f.kind === 'champion')?.pos;
  // Rank room centres by shortest walk, with map room order breaking ties.
  const rooms = s.map.rooms.filter(r => !contains(r, s.map.start) && (!end || !contains(r, end)))
    .filter(r => d[idx(s.map, centre(r))]! >= 0)
    .sort((a, b) => d[idx(s.map, centre(a))]! - d[idx(s.map, centre(b))]!);
  const occupied = new Set([
    ...s.foes.map(f => f.pos), ...s.chests.map(c => c.pos), ...s.barrels,
    ...s.traps.map(t => t.pos), ...s.floorItems.map(f => f.pos),
  ].map(p => idx(s.map, p)));
  // Try every far-half room so an occupied room cannot cancel the guarantee.
  for (const r of rng.shuffle(rooms.slice(Math.floor(rooms.length / 2)))) {
    const cells: Cell[] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const p = { x, y }, k = idx(s.map, p);
      if (tileAt(s.map, p) === 'floor' && d[k]! >= 0 && !occupied.has(k) && (!end || !same(p, end))) cells.push(p);
    }
    if (!cells.length) continue;
    s.floorItems.push({ pos: rng.pick(cells), item: makeWeapon(rng.pick(['dagger', 'sword', 'axe', 'spear', 'mace'] as const), 1) });
    return;
  }
  throw new Error('No free far-half room for the starting melee weapon');
}
