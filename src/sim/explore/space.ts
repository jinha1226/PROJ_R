import { DOOR_POS, ROOM_HALF } from './generate';
import type { Dir, Exploration } from './types';

/** World layout: room (gx, gy) is centered at (gx·30, gy·20); doors open into 6m corridors. */
export const ROOM_PITCH = { x: 30, z: 20 } as const;
const BODY = 0.45;
const CORRIDOR_HALF = 1.5;

export function roomAt(e: Exploration, x: number, z: number): string | null {
  for (const r of Object.values(e.rooms)) {
    const lx = x - r.gx * ROOM_PITCH.x;
    const lz = z - r.gy * ROOM_PITCH.z;
    if (Math.abs(lx) <= ROOM_HALF.x && Math.abs(lz) <= ROOM_HALF.y) return r.id;
  }
  return null;
}

function inCorridor(e: Exploration, x: number, z: number): boolean {
  for (const r of Object.values(e.rooms))
    for (const dir of Object.keys(r.doors) as Dir[]) {
      const d = DOOR_POS[dir];
      const cx = r.gx * ROOM_PITCH.x + d.x;
      const cz = r.gy * ROOM_PITCH.z + d.y;
      const horizontal = dir === 'e' || dir === 'w';
      const len = horizontal ? ROOM_PITCH.x - ROOM_HALF.x * 2 : ROOM_PITCH.z - ROOM_HALF.y * 2;
      const along = horizontal ? (x - cx) * Math.sign(d.x) : (z - cz) * Math.sign(d.y);
      const across = horizontal ? Math.abs(z - cz) : Math.abs(x - cx);
      if (along >= -BODY - 0.6 && along <= len + 0.6 && across <= CORRIDOR_HALF - BODY + 0.2) return true;
    }
  return false;
}

/** True when a body can stand here: inside a room (clear of walls and props) or in a corridor. */
export function canStand(e: Exploration, x: number, z: number): boolean {
  const id = roomAt(e, x, z);
  if (id) {
    const r = e.rooms[id]!;
    const lx = x - r.gx * ROOM_PITCH.x;
    const lz = z - r.gy * ROOM_PITCH.z;
    const inside = Math.abs(lx) <= ROOM_HALF.x - BODY && Math.abs(lz) <= ROOM_HALF.y - BODY;
    if (!inside && !inCorridor(e, x, z)) return false;
    return !r.props.some((p) => Math.hypot(p.x - lx, p.y - lz) < p.r + BODY);
  }
  return inCorridor(e, x, z);
}
