import { expect, it } from 'vitest';
import { severs, shotStyle, slashStyle } from '../../src/view/grid/strikeCues';
import type { GEvent } from '../../src/sim/grid/types';

const bump = (text?: string): GEvent => ({ t: 0, type: 'bump', src: 'hero', dst: 'f1', text });
const shoot = (text = 'pistol'): GEvent => ({ t: 0, type: 'shoot', src: 'hero', dst: 'f1', text });
it('a blow takes its look from its own text, else from the engraving just shown', () => {
  expect(slashStyle(bump('finisher'), null)).toBe('heavy');
  expect(slashStyle(bump('whirl'), null)).toBe('storm');
  expect(slashStyle(bump(), 'tempest')).toBe('storm');
  expect(slashStyle(bump(), 'cull')).toBe('cull');
  expect(slashStyle(bump(), 'dash')).toBe('dash');
  expect(slashStyle(bump(), null)).toBe('plain');
});
it('a shot takes its look from its text (bounce, volley, spin) or the engraving before it (pierce)', () => {
  expect(shotStyle(shoot('ricochet'), null)).toBe('ricochet');
  expect(shotStyle(shoot('volley'), null)).toBe('volley');
  expect(shotStyle(shoot('spin'), 'pierce')).toBe('spin');
  expect(shotStyle(shoot(), 'pierce')).toBe('pierce');
  expect(shotStyle(shoot(), 'gunRelay')).toBe('relay');
  expect(shotStyle(shoot(), null)).toBe('plain');
});
it('only big blows (heavy, cull, pierce, execute) or crits take a part off', () => {
  expect(severs('plain', false)).toBe(false);
  expect(severs('dash', false)).toBe(false);
  expect(severs('heavy', false)).toBe(true);
  expect(severs('pierce', false)).toBe(true);
  expect(severs('plain', true)).toBe(true);
});
