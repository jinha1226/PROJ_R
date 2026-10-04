import { expect, it, vi } from 'vitest';
import { comboCue, type CueKit } from '../../src/view/grid/comboCues';
import { GridFx } from '../../src/view/grid/gridFx';
it('slows a chain and displays its count', () => {
  const slow = vi.fn(), hits = vi.fn();
  const k = { fx: { slow }, pops: { hits } } as unknown as CueKit;
  expect(comboCue(k, { t: 0, type: 'chain', src: 'hero', amount: 4 })).toBe(true);
  expect(slow).toHaveBeenCalledWith(1.4, 0.35); expect(hits).toHaveBeenCalledWith(4, true);
});
it('ends slow motion using wall time and returns to normal speed', () => {
  const fx = Object.assign(Object.create(GridFx.prototype), {
    flashes: { update: vi.fn() }, beams: [], bolts: [], transient: { update: vi.fn() }, stop: 0, shakeT: 0,
  }) as GridFx;
  expect(fx.timeScale).toBe(1);
  fx.slow(1.4, 0.35); expect(fx.timeScale).toBe(0.35);
  fx.update(1); expect(fx.timeScale).toBe(0.35);
  fx.update(0.4); expect(fx.timeScale).toBe(1);
});
