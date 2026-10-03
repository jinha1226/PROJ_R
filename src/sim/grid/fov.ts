import { idx, inBounds, opaque, same, tileAt, type Cell, type GridMap, type GridState } from './types';

/** Steam hangs in the air: it hides what is behind it like a wall. */
const steamAt = (s: Pick<GridState, 'tiles' | 'time'> | undefined, c: Cell): boolean => !!s && s.tiles.some((x) => x.kind === 'steam' && x.until > s.time && same(x.pos, c));

const OCTANTS = [
  [1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1],
  [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1],
] as const;

/** Recursive shadowcasting: every tile visible from `from` within `radius` (walls you can see are included). */
export function computeFov(m: GridMap, from: Cell, radius: number, s?: Pick<GridState, 'tiles' | 'time'>): Set<number> {
  const seen = new Set<number>([idx(m, from)]);
  const r2 = radius * radius + radius;
  const cast = (row: number, start: number, end: number, xx: number, xy: number, yx: number, yy: number): void => {
    if (start < end) return;
    let newStart = start;
    for (let j = row; j <= radius; j++) {
      let blocked = false;
      for (let dx = -j, dy = -j; dx <= 0; dx++) {
        const l = (dx - 0.5) / (dy + 0.5);
        const r = (dx + 0.5) / (dy - 0.5);
        if (start < r) continue;
        if (end > l) break;
        const c = { x: from.x + dx * xx + dy * xy, y: from.y + dx * yx + dy * yy };
        if (dx * dx + dy * dy <= r2 && inBounds(m, c)) seen.add(idx(m, c));
        const wall = opaque(tileAt(m, c)) || steamAt(s, c);
        if (blocked) {
          if (wall) { newStart = r; continue; }
          blocked = false;
          start = newStart;
        } else if (wall && j < radius) {
          blocked = true;
          cast(j + 1, start, l, xx, xy, yx, yy);
          newStart = r;
        }
      }
      if (blocked) break;
    }
  };
  for (const [xx, xy, yx, yy] of OCTANTS) cast(1, 1, 0, xx, xy, yx, yy);
  return seen;
}

/** A clear line between two cells (endpoints excluded): no opaque tile, no blocker, and no squeezing diagonally between two opaque tiles. */
export function losClear(m: GridMap, a: Cell, b: Cell, blockers?: (c: Cell) => boolean, s?: Pick<GridState, 'tiles' | 'time'>): boolean {
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err;
    const px = x;
    const py = y;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (px !== x && py !== y && opaque(tileAt(m, { x, y: py })) && opaque(tileAt(m, { x: px, y }))) return false;
    if (x === b.x && y === b.y) break;
    const c = { x, y };
    if (opaque(tileAt(m, c)) || steamAt(s, c) || blockers?.(c)) return false;
  }
  return true;
}
