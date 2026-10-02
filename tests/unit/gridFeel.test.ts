import { describe, it, expect } from 'vitest';
import { HoldRepeat, quantize8 } from '../../src/app/input/gridInput';
import { chase, CHASE_K } from '../../src/view/grid/chase';
import { CATCHUP, Playback, STAGGER, TURN_SEC } from '../../src/view/grid/playback';
import type { GEvent } from '../../src/sim/grid/types';

describe('8-way input', () => {
  it('snaps a stick vector to one of eight directions with a dead zone', () => {
    expect(quantize8(1, 0)).toEqual({ x: 1, y: 0 });
    expect(quantize8(0.7, 0.7)).toEqual({ x: 1, y: 1 });
    expect(quantize8(0.1, 0.1)).toBeNull();
    expect(quantize8(-1, 0.2)).toEqual({ x: -1, y: 0 });
    expect(quantize8(-0.5, -0.6)).toEqual({ x: -1, y: -1 });
  });

  it('a held direction steps at once, then every 0.14 s; a new direction steps at once', () => {
    const h = new HoldRepeat();
    const r = { x: 1, y: 0 };
    expect(h.update(r, 0.016)).toEqual(r);
    expect(h.update(r, 0.1)).toBeNull();
    expect(h.update(r, 0.05)).toEqual(r);
    expect(h.update(r, 0.1)).toBeNull();
    expect(h.update(r, 0.05)).toEqual(r);
    expect(h.update({ x: 0, y: 1 }, 0.01)).toEqual({ x: 0, y: 1 });
    expect(h.update(null, 0.01)).toBeNull();
    expect(h.update(r, 0.01)).toEqual(r);
  });
});

describe('chase', () => {
  it('halves the gap in ln2/k seconds and never overshoots', () => {
    expect(chase(0, 10, Math.LN2 / CHASE_K)).toBeCloseTo(5);
    expect(chase(0, 10, 10)).toBeLessThanOrEqual(10);
    expect(chase(10, 0, 0.5)).toBeGreaterThanOrEqual(0);
  });
});

describe('event playback', () => {
  const ev = (t: number, src: string, type: GEvent['type'] = 'move'): GEvent => ({ t, type, src });

  it('plays a turn compressed: t=1 fires 0.18 s after t=0', () => {
    const p = new Playback();
    p.push([ev(0, 'hero'), ev(1, 'f1')], 0);
    expect(p.update(0).map((e) => e.src)).toEqual(['hero']);
    expect(p.update(TURN_SEC - 0.01)).toEqual([]);
    expect(p.update(0.02).map((e) => e.src)).toEqual(['f1']);
    expect(p.busy).toBe(false);
  });

  it('staggers different actors acting at the same moment', () => {
    const p = new Playback();
    p.push([ev(2, 'f1'), ev(2, 'f2'), ev(2, 'f1', 'hit')], 2);
    expect(p.update(0).map((e) => e.src)).toEqual(['f1', 'f1']);
    expect(p.update(STAGGER).map((e) => e.src)).toEqual(['f2']);
  });

  it('a new input hurries what is left of the last turn', () => {
    const p = new Playback();
    p.push([ev(0, 'hero'), ev(1, 'f1')], 0);
    p.update(0);
    p.hurry();
    expect(p.update(TURN_SEC / CATCHUP + 0.001).map((e) => e.src)).toEqual(['f1']);
  });

  it('a batch pushed while another is playing queues after it', () => {
    const p = new Playback();
    p.push([ev(0, 'hero'), ev(1, 'f1')], 0);
    p.update(0);
    p.push([ev(1, 'hero')], 1);
    expect(p.update(TURN_SEC + 0.001).map((e) => e.src)).toEqual(['f1', 'hero']);
  });
});
