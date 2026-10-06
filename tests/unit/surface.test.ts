import { expect, it } from 'vitest';
import { distanceMap } from '../../src/sim/grid/path';
import { dist, idx } from '../../src/sim/grid/types';
import { entOf } from '../../src/sim/party/partyCore';
import { generateWorld } from '../../src/sim/overworld/worldGen';
import { canDrill, newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { canAscend, delveTick, newDelve } from '../../src/sim/delve/delveSim';
import { placeParty, takeParty } from '../../src/sim/roam/carry';
import { clones } from '../../src/sim/roam/roam';

it('the pod comes down where the crashed ship lay: the drill rig beside it, the first soul (an archer) nearby, every soul reachable', () => {
  for (const seed of [1, 2, 3, 4]) {
    const w = generateWorld(seed, { pod: true });
    expect(w.pod).toBe(true);
    expect(w.drill).toBeDefined();
    expect(w.souls[0]!.cls).toBe('archer');
    expect(Math.hypot(w.souls[0]!.pos.x - w.base.x, w.souls[0]!.pos.y - w.base.y)).toBeLessThanOrEqual(15);
    expect(w.ground[w.drill!.y * w.map.w + w.drill!.x]).toBe('drill');
    const d = distanceMap(w.map, w.map.start);
    for (const s of w.souls) expect(d[idx(w.map, s.pos)]).toBeGreaterThan(0);
  }
});

it('down the shaft and back up: the clones, souls carried and bio-matter go along', () => {
  const s = newSurface(2);
  entOf(s, 'hero')!.pos = { ...s.souls[0]!.pos }; worldTick(s, 0.1);
  s.bio = 7;
  expect(canDrill(s)).toBe(false);
  entOf(s, 'hero')!.pos = { x: s.drill!.x + 1, y: s.drill!.y };
  worldTick(s, 0.1);
  expect(canDrill(s)).toBe(true);
  const down = newDelve(2, 1, takeParty(s));
  expect(clones(down).map((u) => u.cls)).toEqual(['archer']);
  expect(down.bio).toBe(7);
  for (const u of down.units) if (u.side === 'foe') entOf(down, u.id)!.alive = false;
  delveTick(down, 0.1);
  down.bio = 40;
  expect(canAscend(down)).toBe(true);
  placeParty(s, takeParty(down));
  expect(s.bio).toBe(40);
  expect(clones(s).map((u) => u.cls)).toEqual(['archer']);
  expect(dist(entOf(s, 'hero')!.pos, s.s.map.start)).toBeLessThanOrEqual(1);
});

it('a soul carried up from below gets a body at the pod (bio-matter allowing)', () => {
  const s = newSurface(3);
  entOf(s, 'hero')!.pos = { ...s.souls[0]!.pos }; worldTick(s, 0.1);
  const down = newDelve(3, 1, takeParty(s));
  down.carried.push('cleric'); down.bio = 30;
  placeParty(s, takeParty(down));
  for (let i = 0; i < 10; i++) worldTick(s, 0.1);
  expect(clones(s).map((u) => u.cls)).toEqual(['archer', 'cleric']);
  expect(s.bio).toBe(5);
});
