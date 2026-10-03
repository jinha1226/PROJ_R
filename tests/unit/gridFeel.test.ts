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

  it('a held direction steps after a short chord wait, then every 0.14 s', () => {
    const h = new HoldRepeat();
    const r = { x: 1, y: 0 };
    expect(h.update(r, 0.016)).toBeNull();
    expect(h.update(r, 0.04)).toEqual(r);
    expect(h.update(r, 0.1)).toBeNull();
    expect(h.update(r, 0.05)).toEqual(r);
    expect(h.update(null, 0.01)).toBeNull();
  });

  it('two keys pressed a moment apart make one diagonal step, not a straight step first', () => {
    const h = new HoldRepeat();
    expect(h.update({ x: 0, y: -1 }, 0.016)).toBeNull();
    expect(h.update({ x: 1, y: -1 }, 0.016)).toBeNull();
    expect(h.update({ x: 1, y: -1 }, 0.04)).toEqual({ x: 1, y: -1 });
  });

  it('turning while held waits the chord time too, then steps the new way', () => {
    const h = new HoldRepeat();
    h.update({ x: 1, y: 0 }, 0.06);
    expect(h.update({ x: 0, y: 1 }, 0.01)).toBeNull();
    expect(h.update({ x: 0, y: 1 }, 0.05)).toEqual({ x: 0, y: 1 });
  });

  it('a stick near the 22.5° border keeps its direction instead of zig-zagging', () => {
    const a = (deg: number) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)] as const;
    expect(quantize8(...a(26))).toEqual({ x: 1, y: 1 });
    expect(quantize8(...a(26), 0.35, { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(quantize8(...a(19), 0.35, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(quantize8(...a(10), 0.35, { x: 1, y: 1 })).toEqual({ x: 1, y: 0 });
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

  it('a dash step, a leap, a weave or a shove holds the rest of the show so the combo reads in order', () => {
    for (const [first, hold] of [[{ ...ev(0, 'hero'), text: 'dash' }, 0.1], [{ ...ev(0, 'hero'), text: 'leap' }, 0.26], [ev(0, 'hero', 'parry'), 0.14], [ev(0, 'f1', 'push'), 0.12]] as const) {
      const p = new Playback();
      p.push([first, ev(0, first.src!, 'bump')], 0);
      expect(p.update(0)).toHaveLength(1);
      expect(p.update(hold - 0.01)).toEqual([]);
      expect(p.update(0.02).map((e) => e.type)).toEqual(['bump']);
    }
  });

  it('a plain step holds nothing', () => {
    const p = new Playback();
    p.push([ev(0, 'hero'), ev(0, 'hero', 'bump')], 0);
    expect(p.update(0)).toHaveLength(2);
  });

  it('a batch pushed while another is playing queues after it', () => {
    const p = new Playback();
    p.push([ev(0, 'hero'), ev(1, 'f1')], 0);
    p.update(0);
    p.push([ev(1, 'hero')], 1);
    expect(p.update(TURN_SEC + 0.001).map((e) => e.src)).toEqual(['f1', 'hero']);
  });
});

describe('what interrupts movement', () => {
  it('a new foe in sight stops both a held direction and a walk; a hit only stops a walk', async () => {
    const { interruption } = await import('../../src/app/input/gridInput');
    expect(interruption(true, false)).toEqual({ walk: true, hold: true });
    expect(interruption(false, true)).toEqual({ walk: true, hold: false });
    expect(interruption(false, false)).toEqual({ walk: false, hold: false });
  });
});

describe('smooth stepping', () => {
  it('a held walk glides at a steady speed: one cell per step interval, halfway at half time', async () => {
    const { glide, WALK_SPEED } = await import('../../src/view/grid/chase');
    expect(WALK_SPEED).toBeCloseTo(1 / 0.14, 1);
    const half = glide({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.07);
    expect(half.x).toBeCloseTo(0.5, 1);
    const end = glide({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.2);
    expect(end.x).toBe(1);
  });

  it('a model that fell behind catches up quickly instead of lagging', async () => {
    const { glide } = await import('../../src/view/grid/chase');
    const p = glide({ x: 0, z: 0 }, { x: 4, z: 0 }, 0.1);
    expect(p.x).toBeGreaterThan(2);
    expect(p.x).toBeLessThanOrEqual(4);
  });

  it('turning eases the facing over a few frames instead of snapping', async () => {
    const { turnToward } = await import('../../src/view/grid/chase');
    const a = turnToward(0, Math.PI / 2, 0.016);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(Math.PI / 2);
    expect(turnToward(3, -3, 0.016)).toBeGreaterThan(3);
  });
});
