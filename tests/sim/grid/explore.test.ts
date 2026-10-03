import { describe, expect, it } from 'vitest';
import { exploreTarget } from '../../../src/sim/grid/explore';
import { idx } from '../../../src/sim/grid/types';
import { sim } from './kit';

function corridor() {
  const s = sim(['########', '#......#', '########'], { x: 1, y: 1 }).s;
  s.seen.fill(1);
  s.seen[idx(s.map, { x: 6, y: 1 })] = 0;
  return s;
}
describe('exploration frontier', () => {
  it('finds the seen corridor mouth deterministically', () => {
    const s = corridor();
    expect(exploreTarget(s)).toEqual({ x: 5, y: 1 });
    expect(exploreTarget(s)).toEqual(exploreTarget(s));
  });
  it.each(['trap', 'barrel', 'foe', 'chest'])('cannot cross a %s', (kind) => {
    const s = corridor(), pos = { x: 3, y: 1 };
    if (kind === 'trap') s.traps.push({ pos, kind: 'spike', found: true });
    if (kind === 'barrel') s.barrels.push(pos);
    if (kind === 'chest') s.chests.push({ pos, opened: false });
    if (kind === 'foe') s.foes.push({ ...s.hero, id: 'block', kind: 'minion', pos });
    expect(exploreTarget(s)).toBeNull();
  });
  it('returns null when everything is seen', () => {
    const s = corridor(); s.seen.fill(1);
    expect(exploreTarget(s)).toBeNull();
  });
});
