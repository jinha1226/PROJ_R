import { expect, it } from 'vitest';
import { handSwap } from '../../src/view/grid/handSwap';
it('follows the exact event weapon in both directions', () => {
  expect(handSwap('dagger', 'pistol', 'pistol')).toEqual(['pistol', 'dagger']);
  expect(handSwap('pistol', 'dagger', 'dagger')).toEqual(['dagger', 'pistol']);
  expect(handSwap('pistol', 'dagger', 'pistol')).toBeNull();
  expect(handSwap('pistol', 'dagger', undefined)).toBeNull();
  expect(handSwap('pistol', 'dagger', 'rifle')).toBeNull();
  expect(handSwap('pistol', 'pistol', 'pistol')).toBeNull();
});
