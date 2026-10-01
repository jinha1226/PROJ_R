import type { Vec2 } from '../../core/vec2';
import type { Bounds, Obstacle } from '../battle/types';

const SQRT2 = Math.SQRT2;

/** A conservative occupancy grid: a cell is blocked if any point of it is within `pad` of an obstacle. */
class Occupancy {
  readonly w: number;
  readonly h: number;
  readonly blocked: Uint8Array;

  constructor(readonly b: Bounds, readonly cell: number, obstacles: Obstacle[], clearance: number, conservative: boolean) {
    this.w = Math.ceil((b.maxX - b.minX) / cell);
    this.h = Math.ceil((b.maxY - b.minY) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
    // conservative: every point of a free cell is clear (LOS); otherwise only its centre (routing through door gaps)
    const pad = clearance + (conservative ? (cell * SQRT2) / 2 : cell / 2);
    for (let j = 0; j < this.h; j++)
      for (let i = 0; i < this.w; i++) {
        const c = this.center(i, j);
        const edge = Math.min(c.x - b.minX, b.maxX - c.x, c.y - b.minY, b.maxY - c.y);
        if (edge < clearance + cell / 2 || obstacles.some((o) => near(c, o, pad))) this.blocked[j * this.w + i] = 1;
      }
  }

  center(i: number, j: number): Vec2 {
    return { x: this.b.minX + (i + 0.5) * this.cell, y: this.b.minY + (j + 0.5) * this.cell };
  }

  index(p: Vec2): number {
    const i = Math.floor((p.x - this.b.minX) / this.cell);
    const j = Math.floor((p.y - this.b.minY) / this.cell);
    return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i;
  }

  free(p: Vec2): boolean {
    const k = this.index(p);
    return k >= 0 && !this.blocked[k];
  }
}

function near(p: Vec2, o: Obstacle, pad: number): boolean {
  if (o.kind === 'box' && o.half) return Math.abs(p.x - o.pos.x) < o.half.x + pad && Math.abs(p.y - o.pos.y) < o.half.y + pad;
  return Math.hypot(p.x - o.pos.x, p.y - o.pos.y) < o.radius + pad;
}

/** Binary min-heap keyed by (f, h, index) so ties break the same way every run. */
class Heap {
  private items: { k: number; f: number; h: number }[] = [];
  get size(): number { return this.items.length; }
  push(it: { k: number; f: number; h: number }): void {
    const a = this.items;
    a.push(it);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i]!, a[p]!)) break;
      [a[i], a[p]] = [a[p]!, a[i]!];
      i = p;
    }
  }
  pop(): { k: number; f: number; h: number } {
    const a = this.items;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l]!, a[m]!)) m = l;
        if (r < a.length && less(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!];
        i = m;
      }
    }
    return top;
  }
}
const less = (a: { k: number; f: number; h: number }, b: { k: number; f: number; h: number }) => a.f < b.f || (a.f === b.f && (a.h < b.h || (a.h === b.h && a.k < b.k)));

/** 8-way A* on a 1 m grid with line-of-sight smoothing; LOS uses a finer 0.5 m grid. */
export class NavGrid {
  private readonly coarse: Occupancy;
  private readonly fine: Occupancy;

  constructor(bounds: Bounds, obstacles: Obstacle[], cell = 1, clearance = 0.4) {
    this.coarse = new Occupancy(bounds, cell, obstacles, clearance, false);
    this.fine = new Occupancy(bounds, cell / 2, obstacles, clearance, true);
  }

  walkable(p: Vec2): boolean {
    return this.fine.free(p);
  }

  lineClear(a: Vec2, b: Vec2): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(d / (this.fine.cell * 0.5)));
    for (let s = 0; s <= n; s++) if (!this.fine.free({ x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n })) return false;
    return true;
  }

  /** Waypoints after `from`, ending exactly at `to`; null when `to` cannot be reached. */
  path(from: Vec2, wanted: Vec2): Vec2[] | null {
    // a target hugging a wall: head for the nearest free point instead
    const to = this.walkable(wanted) ? wanted : this.nearestWalkable(wanted, 2);
    if (!to) return null;
    if (this.lineClear(from, to)) return [{ ...to }];
    const g = this.coarse;
    const start = this.nearestFree(g.index(from));
    const goal = this.nearestFree(g.index(to));
    if (start < 0 || goal < 0) return null;
    const gx = goal % g.w;
    const gy = Math.floor(goal / g.w);
    const heur = (k: number) => {
      const dx = Math.abs((k % g.w) - gx);
      const dy = Math.abs(Math.floor(k / g.w) - gy);
      return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
    };
    const cost = new Float64Array(g.w * g.h).fill(Infinity);
    const prev = new Int32Array(g.w * g.h).fill(-1);
    const open = new Heap();
    cost[start] = 0;
    open.push({ k: start, f: heur(start), h: heur(start) });
    while (open.size) {
      const { k, f } = open.pop();
      if (k === goal) break;
      if (f - heur(k) > cost[k]! + 1e-9) continue;
      const x = k % g.w;
      const y = Math.floor(k / g.w);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
          const n = ny * g.w + nx;
          if (g.blocked[n] || (dx && dy && (g.blocked[y * g.w + nx] || g.blocked[ny * g.w + x]))) continue;
          const c = cost[k]! + (dx && dy ? SQRT2 : 1);
          if (c < cost[n]! - 1e-9) {
            cost[n] = c;
            prev[n] = k;
            open.push({ k: n, f: c + heur(n), h: heur(n) });
          }
        }
    }
    if (prev[goal]! < 0 && goal !== start) return null;
    const cells: Vec2[] = [];
    for (let k = goal; k !== start && k >= 0; k = prev[k]!) cells.unshift(g.center(k % g.w, Math.floor(k / g.w)));
    cells.push({ ...to });
    return this.smooth(from, cells);
  }

  /** Flood fill from a point; the returned test answers "can I walk there?". */
  reachable(from: Vec2): (p: Vec2) => boolean {
    const g = this.coarse;
    const seen = new Uint8Array(g.w * g.h);
    const s = this.nearestFree(g.index(from));
    if (s >= 0) {
      const q = [s];
      seen[s] = 1;
      while (q.length) {
        const k = q.pop()!;
        const x = k % g.w;
        const y = Math.floor(k / g.w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          const n = ny * g.w + nx;
          if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h || seen[n] || g.blocked[n]) continue;
          seen[n] = 1;
          q.push(n);
        }
      }
    }
    return (p) => {
      if (!this.walkable(p)) return false;
      const k = this.nearestFree(g.index(p));
      return k >= 0 && seen[k] === 1;
    };
  }

  private nearestWalkable(p: Vec2, maxR: number): Vec2 | null {
    const step = this.fine.cell / 2;
    for (let r = step; r <= maxR; r += step)
      for (let a = 0; a < 16; a++) {
        const q = { x: p.x + Math.cos((a / 16) * Math.PI * 2) * r, y: p.y + Math.sin((a / 16) * Math.PI * 2) * r };
        if (this.walkable(q)) return q;
      }
    return null;
  }

  private nearestFree(k: number): number {
    const g = this.coarse;
    if (k < 0) return -1;
    if (!g.blocked[k]) return k;
    const x0 = k % g.w;
    const y0 = Math.floor(k / g.w);
    for (let r = 1; r <= 3; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = x0 + dx;
          const y = y0 + dy;
          if (x >= 0 && y >= 0 && x < g.w && y < g.h && !g.blocked[y * g.w + x]) return y * g.w + x;
        }
    return -1;
  }

  private smooth(from: Vec2, pts: Vec2[]): Vec2[] {
    const out: Vec2[] = [];
    let anchor = from;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(anchor, pts[j]!)) j--;
      out.push(pts[j]!);
      anchor = pts[j]!;
      i = j + 1;
    }
    return out;
  }
}
