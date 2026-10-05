import { describe, expect, it } from 'vitest';
import { exploreTarget } from '../../src/sim/grid/explore';
import { ENGRAVES } from '../../src/sim/grid/engraveCore';
import { makeWeapon } from '../../src/sim/grid/items';
import { gunCost } from '../../src/sim/grid/kataTargets';
import { heroDmg } from '../../src/sim/grid/weapons';
import { idx } from '../../src/sim/grid/types';
import { springTrap } from '../../src/sim/grid/traps';
import { stepBlocked } from '../../src/sim/grid/actions';
import { findPath } from '../../src/sim/grid/path';
import { OPEN, sim } from '../sim/grid/kit';

describe('found traps', () => {
  it('allows exploration through a found trap to the corridor frontier', () => {
    const { s } = sim(['########', '#......#', '########'], { x: 1, y: 1 });
    s.seen.fill(1);
    s.seen[idx(s.map, { x: 6, y: 1 })] = 0;
    s.traps = [{ pos: { x: 3, y: 1 }, kind: 'spike', found: true }];
    expect(exploreTarget(s)).toEqual({ x: 5, y: 1 });
    expect(stepBlocked(s, s.traps[0]!.pos)).toBe(false);
    expect(findPath(s.map, s.hero.pos, { x: 5, y: 1 }, c => stepBlocked(s, c)))
      .toContainEqual(s.traps[0]!.pos);
  });

  it.each(['spike', 'alarm', 'poison', 'fire', 'teleport', 'net'] as const)('carefully steps over a found %s in two turns without its effect', kind => {
    const g = sim(OPEN, { x: 5, y: 7 });
    const pos = { x: 6, y: 7 }, hp = g.s.hero.hp, time = g.s.time;
    g.s.traps = [{ pos, kind, found: true }];
    const events = g.act({ kind: 'move', dir: { x: 1, y: 0 }, plain: true });
    expect(g.s.hero.hp).toBe(hp);
    expect(g.s.hero.pos).toEqual(pos);
    expect(g.s.time - time).toBe(2);
    expect(g.s.traps).toHaveLength(0);
    expect(g.s.tiles).toHaveLength(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'disarm', src: 'hero', to: pos }));
    expect(events.some(e => e.type === 'trap' || e.type === 'buff')).toBe(false);
  });

  it('still springs an unfound spike when the hero steps on it', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    const hp = g.s.hero.hp;
    g.s.traps = [{ pos: { x: 6, y: 7 }, kind: 'spike', found: false }];
    const events = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.hero.hp).toBeLessThan(hp);
    expect(g.s.traps).toHaveLength(0);
    expect(events.some(e => e.type === 'trap')).toBe(true);
  });

  it('still springs a found trap under a foe', () => {
    const { s } = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    const foe = s.foes[0]!, hp = foe.hp;
    s.traps = [{ pos: { ...foe.pos }, kind: 'spike', found: true }];
    springTrap(s, foe, 0);
    expect(foe.hp).toBeLessThan(hp);
    expect(s.traps).toHaveLength(0);
  });
});

describe('shot chance', () => {
  it.each(['range', 'wall', 'unseen', 'clear'] as const)('checks whether a %s target is shootable', scenario => {
    const g = sim(OPEN, { x: 2, y: 7 }, [{ kind: 'brute', pos: { x: scenario === 'range' ? 13 : 5, y: 7 } }]);
    const foe = g.s.foes[0]!;
    g.s.visible.add(idx(g.s.map, foe.pos));
    if (scenario === 'wall') g.s.map.tiles[idx(g.s.map, { x: 3, y: 7 })] = 'wall';
    if (scenario === 'unseen') g.s.visible.delete(idx(g.s.map, foe.pos));
    if (scenario === 'clear') expect(g.shotChance(foe.id)).toEqual(expect.any(Number));
    else expect(g.shotChance(foe.id)).toBeNull();
  });
});

it('three ranged engravings add one gun damage while pistol cost stays one', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 });
  const pistol = makeWeapon('pistol', 1), sword = makeWeapon('sword', 1);
  s.hero.suit = ['rapid', 'mark'];
  const base = heroDmg(s, pistol), meleeBase = heroDmg(s, sword);
  expect(gunCost(s, pistol)).toBe(1);
  s.hero.suit.push('ricochet');
  expect(heroDmg(s, pistol)).toEqual(base.map(n => n + 1));
  expect(heroDmg(s, sword)).toEqual(meleeBase);
  expect(gunCost(s, pistol)).toBe(1);
  s.hero.suit.pop();
  expect(heroDmg(s, pistol)).toEqual(base);
});

it('gale note describes the two melee kill requirement', () => {
  expect(ENGRAVES.gale.note).toBe('칼로 둘 이상 처치 → 다음 행동 0턴');
});
