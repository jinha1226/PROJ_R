import { describe, it, expect } from 'vitest';
import { lerpAngle, interpUnit } from '../../src/view/playback/interpolate';

const snap = (x: number, facing: number) => ({
  id: 'a', x, y: 0, facing, hp: 1, maxHp: 1, shield: 0, momentum: 0, alive: true, downed: false, lifeline: 0,
  action: null, tags: [], intent: null, forced: null,
});

describe('interpolate', () => {
  it('lerps angles the short way', () => {
    expect(Math.abs(lerpAngle(3, -3, 0.5))).toBeCloseTo(Math.PI, 1);
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });
  it('interpolates positions and falls back without prev', () => {
    expect(interpUnit(snap(0, 0), snap(2, 0), 0.25).x).toBeCloseTo(0.5);
    expect(interpUnit(undefined, snap(2, 0), 0.25).x).toBe(2);
  });
});
