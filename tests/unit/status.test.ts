import { it, expect } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { entOf, stepToward } from '../../src/sim/party/partyCore';
import { applyStatus, tickStatuses, statusMult } from '../../src/sim/party/status';
it('ticks burn and stacked poison on whole seconds', () => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!, e = entOf(p, f.id)!;
  e.hp = e.maxHp = 100; applyStatus(p, u, f, 'burn', 0, []); tickStatuses(p, 0, 3, []); expect(e.hp).toBe(91);
  applyStatus(p, u, f, 'poison', 4, [], 3); tickStatuses(p, 4, 8, []); expect(e.hp).toBe(67);
});
it('bleeds only on steps; shock doubles bleeding', () => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!, e = entOf(p, f.id)!;
  e.hp = e.maxHp = 22;
  applyStatus(p, u, f, 'bleed', 0, []); tickStatuses(p, 0, 1, []); expect(e.hp).toBe(22);
  stepToward(p, f, { x: 9, y: 3 }, 1, []); expect(e.hp).toBe(18);
  applyStatus(p, u, f, 'shock', 1, []); stepToward(p, f, { x: 8, y: 3 }, 2, []); expect(e.hp).toBe(10);
});
it('shatters heavy hits and spreads poison without recursion', () => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!, g = p.units[4]!;
  entOf(p, g.id)!.pos = { x: 11, y: 4 };
  applyStatus(p, u, f, 'freeze', 0, []); expect(statusMult(p, u, f, true, 1, [])).toBe(2); expect(f.status.freeze).toBeUndefined();
  applyStatus(p, u, f, 'burn', 0, []); applyStatus(p, u, f, 'poison', 0, []);
  expect(g.status.poison?.stacks).toBe(2);
});
