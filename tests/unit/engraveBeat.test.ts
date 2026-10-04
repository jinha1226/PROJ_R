import { expect, it } from 'vitest';
import { Playback } from '../../src/view/grid/playback';

it('an engraving firing holds the show a beat before what it set off', () => {
  const p = new Playback();
  p.push([
    { t: 0, type: 'engrave', src: 'hero', text: 'gunRelay' },
    { t: 0, type: 'shoot', src: 'hero', dst: 'f2' },
  ], 0);
  expect(p.update(0.001).map((e) => e.type)).toEqual(['engrave']);
  expect(p.update(0.1)).toEqual([]);
  expect(p.update(0.1).map((e) => e.type)).toEqual(['shoot']);
});

it('an engraving pop slows the show briefly, without cutting a chain slow short', async () => {
  const { GridFx } = await import('../../src/view/grid/gridFx');
  const { vi } = await import('vitest');
  const fx = Object.assign(Object.create(GridFx.prototype), {
    flashes: { update: vi.fn() }, beams: [], bolts: [], transient: { update: vi.fn() }, stop: 0, shakeT: 0,
  }) as InstanceType<typeof GridFx>;
  fx.slow(0.5, 0.45);
  expect(fx.timeScale).toBe(0.45);
  fx.slow(1.4, 0.35);
  fx.slow(0.5, 0.45);
  fx.update(1);
  expect(fx.timeScale).toBe(0.35);
});
