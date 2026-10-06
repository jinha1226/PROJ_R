import { expect, it } from 'vitest';
import { newWorld } from '../../src/sim/overworld/worldSim';
import { statusLine } from '../../src/ui/overworld/worldHud';

it('the top line shows the turn, then ore, crystal, bio-matter (lit once a body is affordable) and souls carried', () => {
  const p = newWorld(3);
  p.ore = 12; p.crystal = 3; p.bio = 30; p.carried = ['archer'];
  const html = statusLine('<b>지상</b>', p);
  expect(html).toContain('턴 <b>0</b>'); expect(html).toContain('광석 <b>12</b>'); expect(html).toContain('마정석 <b>3</b>');
  expect(html).toContain('class="bio ok"'); expect(html).toContain('영혼 <b>1</b>');
  p.bio = 5; p.carried = [];
  expect(statusLine('지상', p)).not.toContain('영혼'); expect(statusLine('지상', p)).toContain('class="bio"');
});
