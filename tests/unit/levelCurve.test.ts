import { expect, it } from 'vitest';
import { entOf, levelDmg } from '../../src/sim/party/partyCore';
import { refitHp } from '../../src/sim/party/partyLevel';
import { scene } from './support/cardScene';

it('each level adds 6% damage and 8% health', () => {
  const { p, u } = scene('warrior');
  u.level = 1; refitHp(p, u); const base = entOf(p, u.id)!.maxHp;
  u.level = 6; refitHp(p, u);
  expect(entOf(p, u.id)!.maxHp).toBe(Math.round(base * 1.4));
  expect(levelDmg(u)).toBeCloseTo(1.3);
});
