import { expect, it } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { unitOf } from '../../src/sim/party/partyCore';
import { unitChips } from '../../src/ui/overworld/unitChips';

it('what a trigger gave and what ails a unit show with turns left; nothing on, nothing shown', () => {
  const p = partyRoom([{ cls: 'archer', weapon: 'longbow' }, { cls: 'warrior', weapon: 'swordShield' }, { cls: 'mage', weapon: 'staff' }]);
  const u = unitOf(p, 'hero')!;
  expect(unitChips(u, 0)).toBe('');
  u.empower = 3; u.nextCrit = true; u.hasteUntil = 2.2;
  u.status.poison = { until: 3, stacks: 2 };
  const html = unitChips(u, 0);
  expect(html).toContain('강화 ×3');
  expect(html).toContain('다음 치명');
  expect(html).toContain('신속 3');
  expect(html).toContain('중독×2 3');
});
