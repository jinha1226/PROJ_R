import { expect, it } from 'vitest';
import { CONSUMABLES } from '../../src/sim/delve/catalog';
import { CONSUMABLE_TEXT } from '../../src/sim/delve/consumableText';
import { gearBase, numbers } from '../../src/sim/delve/gear';

it('every consumable says what it does', () => {
  for (const id of Object.keys(CONSUMABLES)) expect(CONSUMABLE_TEXT[id as keyof typeof CONSUMABLE_TEXT]?.length, id).toBeGreaterThan(2);
});

it('gear numbers split into the base and what sacrifice and power added', () => {
  const it = { id: 'x', def: 'sword', power: 0.25, bonus: { min: 1 } } as never;
  const b = gearBase(it), n = numbers(it);
  expect(b.min).toBeLessThan(n.min);
  expect(gearBase({ id: 'y', def: 'sword', power: 0 } as never)).toEqual(numbers({ id: 'y', def: 'sword', power: 0 } as never));
});
