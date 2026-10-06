import { expect, it } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { cardTarget, targetCardHtml } from '../../src/ui/overworld/targetCard';

const party = () => partyRoom([{ cls: 'warrior', weapon: 'swordShield' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);

it('a hovered foe gets a card with its health, the odds and the damage', () => {
  const p = party(), foe = p.units.find((u) => u.side === 'foe')!;
  const html = targetCardHtml(p, 'hero', cardTarget(p, 'hero', foe.id));
  expect(html).toContain('명중 <b>90%</b>');
  expect(html).toMatch(/피해 <b>\d+-\d+<\/b>/);
  expect(html).toContain('■');
});

it('no foe in view, no card; a hovered ally is not a target', () => {
  const p = party();
  p.combat = false;
  expect(targetCardHtml(p, 'hero', cardTarget(p, 'hero'))).toBe('');
  expect(cardTarget(p, 'hero', 'ally-1')).toBeUndefined();
});
