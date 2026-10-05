import { dist, tileAt, walkable, type Cell, type GridMap } from '../../sim/grid/types';

/** One side of a wall cell that faces a walkable tile; dir points from the wall into the floor. */
export interface WallFace { wall: Cell; floor: Cell; dir: Cell }

const SIDES: Cell[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
const TORCH_GAP = 4;

/** Every wall side you could see from the floor (where a wall panel is drawn). */
export function wallFaces(m: GridMap): WallFace[] {
  const out: WallFace[] = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (tileAt(m, { x, y }) !== 'wall') continue;
    for (const d of SIDES) {
      const floor = { x: x + d.x, y: y + d.y };
      if (walkable(tileAt(m, floor))) out.push({ wall: { x, y }, floor, dir: d });
    }
  }
  return out;
}

/** Wall faces that carry a torch: on plain floor (not doorways), at least TORCH_GAP tiles from each other. */
export function torchSpots(m: GridMap): WallFace[] {
  const picked: WallFace[] = [];
  for (const f of wallFaces(m)) {
    if (tileAt(m, f.floor) !== 'floor') continue;
    if (picked.every((p) => dist(p.floor, f.floor) >= TORCH_GAP)) picked.push(f);
  }
  return picked;
}
