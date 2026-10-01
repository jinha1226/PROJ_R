import { describe, it, expect } from 'vitest';
import { clampZoom, pinchHeight, wheelHeight, ZOOM_MAX, ZOOM_MIN, loadZoom, saveZoom } from '../../src/app/input/zoom';

describe('zoom', () => {
  it('keeps the view between the closest and the widest height', () => {
    expect(clampZoom(1)).toBe(ZOOM_MIN);
    expect(clampZoom(100)).toBe(ZOOM_MAX);
    expect(clampZoom(12)).toBe(12);
  });

  it('spreading two fingers zooms in, pinching them together zooms out', () => {
    expect(pinchHeight(12, 100, 200)).toBe(ZOOM_MIN);
    expect(pinchHeight(12, 100, 150)).toBeCloseTo(8);
    expect(pinchHeight(12, 150, 100)).toBeCloseTo(18);
  });

  it('the wheel zooms out scrolling down and in scrolling up', () => {
    expect(wheelHeight(12, 100)).toBeGreaterThan(12);
    expect(wheelHeight(12, -100)).toBeLessThan(12);
    expect(wheelHeight(ZOOM_MAX, 1000)).toBe(ZOOM_MAX);
  });

  it('remembers the zoom per screen orientation and falls back to the defaults', () => {
    const store = new Map<string, string>();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(loadZoom(ls)).toEqual({ portrait: 15, landscape: 11 });
    saveZoom({ portrait: 9, landscape: 20 }, ls);
    expect(loadZoom(ls)).toEqual({ portrait: 9, landscape: 20 });
    store.set('projr.zoom', 'garbage');
    expect(loadZoom(ls)).toEqual({ portrait: 15, landscape: 11 });
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadZoom(broken)).toEqual({ portrait: 15, landscape: 11 });
    expect(() => saveZoom({ portrait: 9, landscape: 20 }, broken)).not.toThrow();
  });
});
