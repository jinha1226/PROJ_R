import type { Rng } from '../../core/rng';
import type { Bounds, Obstacle } from '../battle/types';
import type { Decor, Region } from './regionTypes';

const box = (x: number, y: number, hx: number, hy: number): Obstacle => ({ pos: { x, y }, radius: 0, kind: 'box', half: { x: hx, y: hy } });

/** Splits [lo, hi] into solid runs around gaps (gap centres, gap width). */
function runs(lo: number, hi: number, gaps: number[], width: number): [number, number][] {
  const out: [number, number][] = [];
  let a = lo;
  for (const g of [...gaps].sort((x, y) => x - y)) {
    if (g - width / 2 > a) out.push([a, g - width / 2]);
    a = g + width / 2;
  }
  if (a < hi) out.push([a, hi]);
  return out;
}

/** One of three terrain frames: crossing roads, a river with bridges, or a canyon with passes. */
export function buildLayout(rng: Rng, b: Bounds): { layout: Region['layout']; decor: Decor[]; blockers: Obstacle[] } {
  const layout = rng.pick(['cross', 'river', 'canyon'] as const);
  const decor: Decor[] = [];
  const blockers: Obstacle[] = [];
  if (layout === 'cross') {
    const ry = rng.int(-15, 15);
    const rx = rng.int(-25, 25);
    decor.push({ kind: 'road', pos: { x: 0, y: ry }, half: { x: (b.maxX - b.minX) / 2, y: 2 } });
    decor.push({ kind: 'road', pos: { x: rx, y: 0 }, half: { x: 2, y: (b.maxY - b.minY) / 2 } });
  } else if (layout === 'river') {
    const ry = rng.int(-12, 12);
    const g1 = rng.int(-45, -10);
    const g2 = rng.int(10, 45);
    for (const [a, z] of runs(b.minX, b.maxX, [g1, g2], 6)) {
      const o = box((a + z) / 2, ry, (z - a) / 2, 1.6);
      blockers.push(o);
      decor.push({ kind: 'water', pos: o.pos, half: o.half! });
    }
    for (const g of [g1, g2]) decor.push({ kind: 'road', pos: { x: g, y: ry }, half: { x: 2.2, y: 3 } });
  } else {
    for (const cx of [rng.int(-28, -16), rng.int(16, 28)]) {
      const gaps = [rng.int(-35, -10), rng.int(10, 35)];
      for (const [a, z] of runs(b.minY, b.maxY, gaps, 7)) {
        const o = box(cx, (a + z) / 2, 2, (z - a) / 2);
        blockers.push(o);
        decor.push({ kind: 'cliff', pos: o.pos, half: o.half! });
      }
    }
  }
  return { layout, decor, blockers };
}
