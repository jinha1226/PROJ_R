import { expect, it } from 'vitest';
import { barState } from '../../src/view/grid/hpBars';

it.each([
  [10, 10, true, false, false, 1],
  [4, 10, true, false, true, 0.4],
  [10, 10, true, true, true, 1],
  [0, 10, false, true, false, 0],
  [-2, 10, false, false, false, 0],
  [12, 10, true, false, false, 1],
  [0, 0, false, false, false, 0],
])('bar state for hp %s / %s', (hp, maxHp, alive, elite, show, frac) => {
  expect(barState({ hp: hp as number, maxHp: maxHp as number, alive: alive as boolean, elite: elite as boolean })).toEqual({ show, frac, elite });
});
