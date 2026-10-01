import { describe, it, expect } from 'vitest';
import { Trail } from '../../src/view/explore/partyTrail';

describe('party trail', () => {
  it('followers keep their order and spacing along the leader path', () => {
    const t = new Trail();
    for (let x = 0; x <= 10; x += 0.25) t.push({ x, z: 0 });
    const p = t.positions(3, 1.2);
    expect(p[0]!.x).toBeCloseTo(8.8, 1);
    expect(p[1]!.x).toBeCloseTo(7.6, 1);
    expect(p[2]!.x).toBeCloseTo(6.4, 1);
  });
  it('bunches up at the start when the path is short', () => {
    const t = new Trail();
    t.push({ x: 0, z: 0 });
    t.push({ x: 0.5, z: 0 });
    expect(t.positions(2, 1.2).every((q) => q.x >= 0)).toBe(true);
  });
});
