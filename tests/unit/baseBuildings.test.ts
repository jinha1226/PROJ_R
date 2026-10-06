import { describe, expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { buildingsAt, canPlace, demolish, onReturn, place, recommendedLayout } from '../../src/sim/base/buildings';
import { findPath } from '../../src/sim/grid/path';
import { idx } from '../../src/sim/grid/types';
import { sacrifice, starterGear } from '../../src/sim/delve/gear';

const setup = () => { const p = newSurface(); p.ore = 500; p.bio = 20; return p; };
describe('buildings', () => {
  it('requires claimed walkable unoccupied footprints and pays exactly', () => {
    const p = setup(), at = { x: 50, y: 45 };
    expect(canPlace(p, 'wall', { x: 0, y: 0 })).toBe(false);
    expect(canPlace(p, 'wall', p.s.hero.pos)).toBe(false);
    expect(canPlace(p, 'wall', p.s.map.start)).toBe(false);
    expect(canPlace(p, 'wall', { x: -1, y: 45 })).toBe(false);
    expect(place(p, 'wall', at)).toBe(true); expect(p.ore).toBe(499);
    expect(place(p, 'wall', at)).toBe(false);
    expect(buildingsAt(p, at)?.hp).toBe(40);
    expect(p.s.map.tiles[idx(p.s.map, at)]).toBe('wall');
    expect(findPath(p.s.map, { x: 49, y: 45 }, at)).toBeNull();
    expect(demolish(p, p.buildings[0]!.id)).toBe(true);
    expect(p.ore).toBe(499); expect(p.s.map.tiles[idx(p.s.map, at)]).toBe('floor');
    p.ore = 0; expect(place(p, 'wall', at)).toBe(false);
  });
  it('gates let heroes pass, palisades give cover, towers claim land, refunds round down', () => {
    const p = setup(), at = { x: 50, y: 45 };
    place(p, 'gate', at); expect(findPath(p.s.map, { x: 49, y: 45 }, at)?.length).toBe(1);
    demolish(p, p.buildings[0]!.id); expect(p.ore).toBe(498);
    place(p, 'palisade', at); expect(p.cover![idx(p.s.map, at)]).toBe(1);
    demolish(p, p.buildings[0]!.id); expect(p.cover![idx(p.s.map, at)]).toBe(0);
    const before = p.claimed.reduce((a, b) => a + b, 0);
    place(p, 'watchtower', { x: 48, y: 38 });
    expect(p.claimed.reduce((a, b) => a + b, 0)).toBeGreaterThan(before);
  });
  it('infirmary heals returning clones and forge improves actual sacrifice', () => {
    const p = setup(); place(p, 'infirmary', { x: 50, y: 45 });
    expect([p.ore, p.bio]).toEqual([460, 10]); p.s.hero.hp = 1;
    onReturn(p); expect(p.s.hero.hp).toBe(p.s.hero.maxHp);
    place(p, 'forge', { x: 44, y: 44 });
    const u = p.units[0]!; u.cls = 'warrior'; u.gear = starterGear('warrior', () => 'worn');
    p.pack.push({ id: 'food', def: 'swordShield', power: 0 });
    sacrifice(p, u.id, 'food'); expect(u.gear.weapon!.power).toBeCloseTo(.35);
  });
  it('recommended layout stays affordable and does not trap the party', () => {
    const p = setup(); p.ore = 80;
    const layout = recommendedLayout(p);
    expect(layout.filter(b => b.kind === 'gate')).toHaveLength(2);
    expect(layout.filter(b => b.kind === 'watchtower')).toHaveLength(2);
    for (const b of layout) expect(place(p, b.kind, b.at)).toBe(true);
    expect(p.ore).toBeGreaterThanOrEqual(0);
    expect(findPath(p.s.map, p.s.map.start, { x: 60, y: 48 })).not.toBeNull();
  });
});
