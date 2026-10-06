import { expect, it } from 'vitest';
import { entOf, hitChance, unitOf } from '../../src/sim/party/partyCore';
import { partyRoom } from '../../src/sim/party/partySim';

const foeOf = (p: ReturnType<typeof partyRoom>) => p.units.find((u) => u.side === 'foe')!;

it('a blade lands nine in ten on an open foe', () => {
  const p = partyRoom([{ cls: 'warrior', weapon: 'swordShield' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  expect(hitChance(p, unitOf(p, 'hero')!, foeOf(p), 0)).toBeCloseTo(0.9);
});

it('a shot lands less often than a blade, and blinding halves it', () => {
  const p = partyRoom([{ cls: 'warrior', weapon: 'swordShield' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  const archer = unitOf(p, 'ally-1')!, foe = foeOf(p);
  const open = hitChance(p, archer, foe, 0);
  expect(open).toBeGreaterThan(0.4);
  expect(open).toBeLessThanOrEqual(0.9);
  archer.blindUntil = 10;
  expect(hitChance(p, archer, foe, 0)).toBeCloseTo(open / 2);
  expect(entOf(p, foe.id)).toBeDefined();
});
