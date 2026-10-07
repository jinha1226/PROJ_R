import { expect, it } from 'vitest';
import { chainArena } from '../../src/ui/delve/chainArena';
import { alive, entOf } from '../../src/sim/party/partyCore';

it('the arena is a horde: twenty and more weak foes that fall to a blow or two, and a few tougher ones', () => {
  const p = chainArena(7);
  const foes = p.units.filter((u) => u.side === 'foe' && alive(p, u));
  expect(foes.length).toBeGreaterThanOrEqual(20);
  const weak = foes.filter((f) => entOf(p, f.id)!.maxHp <= 12);
  expect(weak.length).toBeGreaterThanOrEqual(foes.length - 4);
});
