import { expect, it } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { unitOf } from '../../src/sim/party/partyCore';
import { skillsHtml } from '../../src/ui/overworld/pipSkills';

it('the skills tab lists each skill as name, a "… 시" condition and a coloured effect', () => {
  const p = partyRoom([{ cls: 'archer', weapon: 'longbow' }, { cls: 'warrior', weapon: 'swordShield' }, { cls: 'mage', weapon: 'staff' }]);
  const html = skillsHtml(p, unitOf(p, 'hero'));
  expect(html).toContain('정조준');
  expect(html).toContain('화살비');
  expect(html).toContain('class="k-when"');
  expect(html).toContain('직접 사용 (R)');
  expect(html).toMatch(/<b class="k-num">\d+/);
});
