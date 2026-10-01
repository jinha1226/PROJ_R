import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/sim/run/mapgen';
import type { MapNode, RunMap } from '../../src/sim/run/types';

const atStep = (m: RunMap, s: number): MapNode[] => Object.values(m.nodes).filter((n) => n.step === s).sort((a, b) => a.lane - b.lane);

describe('map generation', () => {
  for (const seed of [1, 2, 3, 77, 1234]) {
    it(`follows the spec layout (seed ${seed})`, () => {
      const m = generateMap(seed);
      expect(m.steps).toBe(12);
      for (let s = 1; s <= 11; s++) expect(atStep(m, s)).toHaveLength(3);
      expect(atStep(m, 12).map((n) => n.type)).toEqual(['boss']);
      expect(atStep(m, 1).every((n) => n.type === 'battle')).toBe(true);
      expect(atStep(m, 2).every((n) => n.type === 'encounter')).toBe(true);
      expect(atStep(m, 11).every((n) => n.type === 'rest')).toBe(true);
      expect(atStep(m, 6).some((n) => n.type === 'rest')).toBe(true);
      for (const n of Object.values(m.nodes)) if (n.type === 'elite') expect(n.step).toBeGreaterThanOrEqual(4);
      expect(Object.values(m.nodes).some((n) => n.type === 'shop' && n.step >= 3 && n.step <= 10)).toBe(true);
      for (const n of Object.values(m.nodes)) {
        for (const id of n.next) {
          const to = m.nodes[id]!;
          expect(to.step).toBe(n.step + 1);
          if (to.type !== 'boss') expect(Math.abs(to.lane - n.lane)).toBeLessThanOrEqual(1);
        }
        if (n.step < 12) expect(n.next.length).toBeGreaterThan(0);
      }
      expect(atStep(m, 11).every((n) => n.next.length === 1 && m.nodes[n.next[0]!]!.type === 'boss')).toBe(true);
    });
  }
  it('is deterministic', () => {
    expect(generateMap(9)).toEqual(generateMap(9));
    expect(generateMap(9)).not.toEqual(generateMap(10));
  });
});
