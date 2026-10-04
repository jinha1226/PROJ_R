import { expect, it } from 'vitest';
import { ENGRAVES } from '../../src/sim/grid/engraveCore';
import { freshMeta } from '../../src/sim/grid/meta';
import { panelContents } from '../../src/ui/grid/ship/panelContents';
import { resonanceMarks } from '../../src/ui/grid/suitTiles';
import { OPEN, sim } from '../sim/grid/kit';
it('groups the suit shop by family with terse headers and actual prices', () => {
  const m = freshMeta(); m.tasted = ['bloodlust']; m.energy = 30;
  const model = panelContents(m, 'suitlab', { gun: 'pistol', start: 1, startSuit: [] });
  expect(model.groups.map(g => g.label)).toEqual(['근접', '원거리', '퓨전', '원소']);
  for (const group of model.groups) for (const entry of group.shop) {
    const id = entry.id.slice('engrave:'.length) as keyof typeof ENGRAVES;
    expect(ENGRAVES[id].family).toBe(group.id);
  }
  expect(model.groups[0]!.shop.find(e => e.id === 'engrave:bloodlust')).toMatchObject({ label: '피의 갈증 ⚡25', enabled: true });
  expect(model.groups.flatMap(g => g.shop)).toEqual(model.shop.filter(e => e.id.startsWith('engrave:')));
});
it('HUD marks count only equipped unique ids and update immediately on removal', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 });
  s.hero.suit = ['bloodlust', 'fury', 'shoulder']; s.run.unlocked = ['rapid', 'mark', 'sniper'];
  expect(resonanceMarks(s)).toEqual([
    { id: 'melee', label: '근접 3', lit: true }, { id: 'ranged', label: '원거리 0', lit: false },
    { id: 'fusion', label: '퓨전 0', lit: false }, { id: 'element', label: '원소 0', lit: false },
  ]);
  s.hero.suit.pop(); expect(resonanceMarks(s)[0]).toEqual({ id: 'melee', label: '근접 2', lit: false });
});
