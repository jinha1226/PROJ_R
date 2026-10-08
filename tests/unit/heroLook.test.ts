import { expect, it } from 'vitest';
import { heroLook, stanceFor } from '../../src/view/grid/heroLook';

it('empty hands show nothing in hand, never a blade', () => {
  expect(heroLook(undefined, false)).toBe('none');
  expect(stanceFor('none')).toBe('Idle_Loop');
});

it('aboard the ship the hero carries no weapon', () => {
  expect(heroLook('bow', true)).toBe('none');
});

it('in the dungeon the hand shows the group in use with its stance', () => {
  expect(heroLook('bow', false)).toBe('bow');
  expect(stanceFor('bow')).toBe('Idle_Loop');
  expect(stanceFor('sword')).toBe('Sword_Idle');
});
