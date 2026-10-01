import { describe, it, expect } from 'vitest';
import { NavGrid } from '../../src/sim/world/nav';
import type { Obstacle } from '../../src/sim/battle/types';

const B = { minX: -30, maxX: 30, minY: -20, maxY: 20 };
const wall = (x: number, y: number, hx: number, hy: number): Obstacle => ({ pos: { x, y }, radius: 0, kind: 'box', half: { x: hx, y: hy } });
const len = (p: { x: number; y: number }[]) => p.reduce((a, q, i) => (i ? a + Math.hypot(q.x - p[i - 1]!.x, q.y - p[i - 1]!.y) : 0), 0);

describe('nav grid', () => {
  it('goes straight when nothing is in the way', () => {
    const g = new NavGrid(B, []);
    const p = g.path({ x: -10, y: 0 }, { x: 10, y: 0 })!;
    expect(p.length).toBeLessThanOrEqual(2);
    expect(p[p.length - 1]).toEqual({ x: 10, y: 0 });
  });

  it('walks around a wall and keeps clear of it', () => {
    const w = wall(0, 0, 1, 10);
    const g = new NavGrid(B, [w]);
    const p = g.path({ x: -10, y: 0 }, { x: 10, y: 0 })!;
    expect(p).not.toBeNull();
    expect(len([{ x: -10, y: 0 }, ...p])).toBeGreaterThan(20);
    const q = [{ x: -10, y: 0 }, ...p];
    for (let i = 1; i < q.length; i++)
      for (let t = 0; t <= 1; t += 0.05) {
        const x = q[i - 1]!.x + (q[i]!.x - q[i - 1]!.x) * t;
        const y = q[i - 1]!.y + (q[i]!.y - q[i - 1]!.y) * t;
        expect(Math.abs(x) < 1.3 && Math.abs(y) < 10.3, `inside wall at ${x},${y}`).toBe(false);
      }
  });

  it('returns null for an unreachable goal and flood-fills reachability', () => {
    const ring = [wall(10, 0, 0.5, 6), wall(20, 0, 0.5, 6), wall(15, 6, 5.5, 0.5), wall(15, -6, 5.5, 0.5)];
    const g = new NavGrid(B, ring);
    expect(g.path({ x: -10, y: 0 }, { x: 15, y: 0 })).toBeNull();
    const reach = g.reachable({ x: -10, y: 0 });
    expect(reach({ x: 15, y: 0 })).toBe(false);
    expect(reach({ x: 25, y: 15 })).toBe(true);
    expect(g.walkable({ x: 10, y: 0 })).toBe(false);
  });

  it('is deterministic', () => {
    const g = new NavGrid(B, [wall(0, 0, 1, 10), wall(8, 5, 3, 1)]);
    expect(g.path({ x: -12, y: -3 }, { x: 14, y: 7 })).toEqual(g.path({ x: -12, y: -3 }, { x: 14, y: 7 }));
  });

  it('finds a long path on a 120x90 region quickly', () => {
    const big = new NavGrid({ minX: -60, maxX: 60, minY: -45, maxY: 45 }, Array.from({ length: 12 }, (_, i) => wall(-50 + i * 9, (i % 2 ? 1 : -1) * 15, 1, 28)));
    const t0 = performance.now();
    const p = big.path({ x: -58, y: 0 }, { x: 58, y: 0 });
    expect(p).not.toBeNull();
    expect(performance.now() - t0).toBeLessThan(50);
  });
});
