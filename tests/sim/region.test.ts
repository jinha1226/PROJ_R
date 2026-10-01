import { describe, it, expect } from 'vitest';
import { generateRegion, REGION_BOUNDS, type Region } from '../../src/sim/extract/region';
import { NavGrid } from '../../src/sim/world/nav';
import type { Obstacle } from '../../src/sim/battle/types';

const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (p: { x: number; y: number }, o: Obstacle) =>
  o.kind === 'box' ? Math.abs(p.x - o.pos.x) < o.half!.x && Math.abs(p.y - o.pos.y) < o.half!.y : d(p, o.pos) < o.radius;
const openDoors = (r: Region) => r.obstacles.filter((o) => !r.pois.some((p) => p.door?.box === o));

describe('region generation', () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`builds a playable region (seed ${seed})`, () => {
      const r = generateRegion(seed);
      expect(r.bounds).toEqual(REGION_BOUNDS);
      expect(r.pois.length).toBeGreaterThanOrEqual(8);
      expect(r.pois.length).toBeLessThanOrEqual(10);
      for (let i = 0; i < r.pois.length; i++) for (let j = i + 1; j < r.pois.length; j++) expect(d(r.pois[i]!.center, r.pois[j]!.center)).toBeGreaterThanOrEqual(22);
      const kinds = r.pois.map((p) => p.kind);
      for (const k of ['ruins', 'camp', 'nest', 'temple', 'vault', 'boss'] as const) expect(kinds, k).toContain(k);

      // boss is the farthest point of interest from the start
      const boss = r.pois.find((p) => p.kind === 'boss')!;
      expect(Math.max(...r.pois.map((p) => d(p.center, r.start)))).toBe(d(boss.center, r.start));

      // the vault key lies outside the vault
      const vault = r.pois.find((p) => p.kind === 'vault')!;
      const keyBox = r.containers.find((c) => c.extra?.includes('x_vault_key'))!;
      expect(keyBox).toBeTruthy();
      expect(d(keyBox.pos, vault.center)).toBeGreaterThan(vault.radius);

      // everything reachable on foot (vault interior only once its door opens)
      const reach = new NavGrid(r.bounds, openDoors(r)).reachable(r.start);
      for (const p of r.pois) expect(reach(p.center), `${p.kind} ${p.id}`).toBe(true);
      for (const e of r.extracts) expect(reach(e.pos), `extract ${e.id}`).toBe(true);
      for (const c of r.containers) expect(reach(c.pos), `container ${c.id}`).toBe(true);
      const locked = new NavGrid(r.bounds, r.obstacles).reachable(r.start);
      expect(locked(r.containers.find((c) => c.kind === 'vault')!.pos)).toBe(false);

      // nothing spawns inside an obstacle; unit budget respected
      for (const s of r.spawns) for (const o of r.obstacles) expect(inside(s.pos, o), `spawn ${s.id}`).toBe(false);
      for (const c of r.containers) for (const o of r.obstacles) expect(inside(c.pos, o), `container ${c.id}`).toBe(false);
      expect(r.spawns.length).toBeLessThanOrEqual(80);

      // extraction: 2–3 points away from the start, exactly one closes at night
      expect(r.extracts.length).toBeGreaterThanOrEqual(2);
      expect(r.extracts.length).toBeLessThanOrEqual(3);
      expect(r.extracts.filter((e) => e.closesAt !== undefined).length).toBe(1);
      for (const e of r.extracts) expect(d(e.pos, r.start)).toBeGreaterThanOrEqual(40);
    });
  }

  it('is deterministic and survives a JSON round trip', () => {
    const a = generateRegion(7);
    expect(generateRegion(7)).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(generateRegion(8)).not.toEqual(a);
  });
});
