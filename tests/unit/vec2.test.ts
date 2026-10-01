import { describe, it, expect } from 'vitest';
import { v, add, sub, len, norm, clampLen, dist, angleOf, fromAngle, perp, lerp } from '../../src/core/vec2';

describe('vec2', () => {
  it('basic ops', () => {
    expect(add(v(1, 2), v(3, 4))).toEqual({ x: 4, y: 6 });
    expect(sub(v(1, 2), v(3, 4))).toEqual({ x: -2, y: -2 });
    expect(len(v(3, 4))).toBe(5);
    expect(dist(v(0, 0), v(3, 4))).toBe(5);
    expect(lerp(v(0, 0), v(2, 4), 0.5)).toEqual({ x: 1, y: 2 });
  });
  it('norm of zero is zero, clampLen caps', () => {
    expect(norm(v(0, 0))).toEqual({ x: 0, y: 0 });
    expect(len(clampLen(v(10, 0), 2))).toBeCloseTo(2);
    expect(clampLen(v(1, 0), 2)).toEqual({ x: 1, y: 0 });
  });
  it('angles and perp', () => {
    const a = fromAngle(angleOf(v(0, 1)));
    expect(a.x).toBeCloseTo(0);
    expect(a.y).toBeCloseTo(1);
    const p = perp(v(1, 0));
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBe(1);
  });
});
