import { implantCarried } from '../../src/sim/roam/roam';
import { printClone } from '../../src/sim/base/cloner';
import { expect, it } from 'vitest';
import { distanceMap } from '../../src/sim/grid/path';
import { dist, idx } from '../../src/sim/grid/types';
import { entOf } from '../../src/sim/party/partyCore';
import { generateWorld } from '../../src/sim/overworld/worldGen';
import { canDrill, newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { canAscend, delveTick, newDelve } from '../../src/sim/delve/delveSim';
import { placeParty, takeParty } from '../../src/sim/roam/carry';
import { clones } from '../../src/sim/roam/roam';

it('the pod comes down where the crashed ship lay and is the shaft itself, its lab beside it; the first soul (an archer) nearby, every soul reachable', () => {
  for (const seed of [1, 2, 3, 4]) {
    const w = generateWorld(seed, { pod: true });
    expect(w.pod).toBe(true);
    expect(w.drill).toBeDefined();
    expect(w.souls[0]!.cls).toBe('archer');
    expect(Math.hypot(w.souls[0]!.pos.x - w.base.x, w.souls[0]!.pos.y - w.base.y)).toBeLessThanOrEqual(15);
    expect(w.drill).toEqual(w.base); expect(w.ground[w.drill!.y * w.map.w + w.drill!.x]).toBe('ship');
    const d = distanceMap(w.map, w.map.start);
    for (const s of w.souls) expect(d[idx(w.map, s.pos)]).toBeGreaterThan(0);
  }
});

it('down the shaft and back up: the clones, souls carried and ore go along', () => {
  const s = newSurface(2);
  entOf(s, 'hero')!.pos = { ...s.souls[0]!.pos }; worldTick(s, 0.1); implantCarried(s, 'hero', 0);
  s.ore = 7;
  // base mode: a clone at home can go down from wherever it stands
  expect(canDrill(s)).toBe(true);
  const down = newDelve(2, 1, takeParty(s));
  expect(clones(down).map((u) => u.cls)).toEqual(['archer']);
  expect(down.ore).toBe(7);
  for (const u of down.units) if (u.side === 'foe') entOf(down, u.id)!.alive = false;
  delveTick(down, 0.1);
  down.ore = 40;
  expect(canAscend(down)).toBe(true);
  placeParty(s, takeParty(down));
  expect(s.ore).toBe(40);
  expect(clones(s).map((u) => u.cls)).toEqual(['archer']);
  expect(dist(entOf(s, 'hero')!.pos, s.s.map.start)).toBeLessThanOrEqual(1);
});

it('a soul carried up from below waits for a body the player prints at the lab', () => {
  const s = newSurface(3);
  entOf(s, 'hero')!.pos = { ...s.souls[0]!.pos }; worldTick(s, 0.1); implantCarried(s, 'hero', 0);
  const down = newDelve(3, 1, takeParty(s));
  down.carried.push('cleric');
  placeParty(s, takeParty(down));
  for (let i = 0; i < 10; i++) worldTick(s, 0.1);
  expect(clones(s).map((u) => u.cls)).toEqual(['archer']);
  entOf(s, 'hero')!.pos = { x: s.cloner!.x, y: s.cloner!.y + 1 }; printClone(s);
  expect(clones(s).map((u) => u.cls)).toEqual(['archer', 'shell']);
  expect(s.ore + s.crystal).toBe(0);
  implantCarried(s, clones(s)[1]!.id, 0);
  expect(clones(s).map((u) => u.cls)).toEqual(['archer', 'cleric']);
});

it('the land round the pod holds no camps and no goblins (raids will come from the edge)', () => {
  for (const seed of [1, 2, 3]) {
    const w = generateWorld(seed, { pod: true });
    expect(w.camps).toEqual([]);
    expect(w.map.spawns).toEqual([]);
    const s = newSurface(seed);
    expect(s.units.filter((u) => u.side === 'foe')).toEqual([]);
    expect(s.s.foes).toEqual([]);
  }
});

it('a party wiped out below comes up empty: the pod wakes a new empty body and the run goes on', () => {
  const s = newSurface(4);
  const down = newDelve(4, 1, takeParty(s));
  for (const u of down.units) if (u.side === 'hero') entOf(down, u.id)!.alive = false;
  placeParty(s, takeParty(down));
  const ev = worldTick(s, 0.1);
  expect(ev.some((e) => e.type === 'dead')).toBe(false);
  for (let i = 0; i < 40; i++) worldTick(s, 0.1);
  expect(s.over).toBeFalsy();
  expect(clones(s).map((u) => u.cls)).toEqual(['shell']);

  const t = newSurface(5);
  const below = newDelve(5, 1, takeParty(t));
  for (const u of below.units) if (u.side === 'hero') entOf(below, u.id)!.alive = false;
  placeParty(t, takeParty(below));
  for (let i = 0; i < 40; i++) worldTick(t, 0.1);
  expect(t.over).toBeFalsy();
  expect(clones(t).map((u) => u.cls)).toEqual(['shell']);
});

it('the pod stands in the way but does not block sight (no dark wedge behind it before or after it lands)', () => {
  const w = generateWorld(2, { pod: true });
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const t = w.map.tiles[idx(w.map, { x: w.base.x + dx!, y: w.base.y + dy! })]!;
    expect(t).toBe('chasm');
  }
});

it('the pod\'s ground ends two rows south of it: nothing past the edge can be walked on, the clones start north of it, and the horde\'s way to the dome never goes round the south', async () => {
  const { POD_SOUTH } = await import('../../src/sim/overworld/worldGen');
  const { siegeField } = await import('../../src/sim/base/siegePath');
  const p = newSurface(3), m = p.s.map, edge = p.base.y + POD_SOUTH;
  expect(m.start.y).toBe(edge); expect(m.tiles[idx(m, m.start)]).toBe('floor');
  for (let y = edge + 1; y < m.h; y++) for (let x = 0; x < m.w; x++) expect(m.tiles[y * m.w + x]).not.toBe('floor');
  const field = siegeField(p);
  for (let y = edge + 1; y < m.h; y++) for (let x = 0; x < m.w; x++) expect(field[y * m.w + x]).toBe(-1);
  // souls that would have lain south of the edge lie north of it
  for (const s of p.souls) expect(s.pos.y).toBeLessThanOrEqual(edge);
  // the land that has no pod is whole
  const w = generateWorld(3);
  expect(w.map.tiles[idx(w.map, { x: w.base.x + 6, y: w.base.y + 6 })]).not.toBe('chasm');
});
