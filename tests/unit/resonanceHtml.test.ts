import { expect, it } from 'vitest';
import { resonanceHtml } from '../../src/ui/overworld/resonanceHtml';
import { cardsOf, scene } from './support/cardScene';

it('the status tab lists each tag with its count toward the next law, lit laws marked', () => {
  const { p, u } = scene('mage'); u.gear = undefined;
  u.traits = cardsOf('화염', 3);
  const html = resonanceHtml(p, u);
  expect(html).toContain('#화염'); expect(html).toContain('3/6'); expect(html).toContain('class="on"');
});

it('no cards, no resonance block', () => {
  const { p, u } = scene('mage'); u.gear = undefined; u.weapon = 'staff'; u.traits = {};
  expect(resonanceHtml(p, u)).toBe('');
});
