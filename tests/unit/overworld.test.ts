import { expect, it } from 'vitest';
import { distanceMap } from '../../src/sim/grid/path';
import { dist, idx } from '../../src/sim/grid/types';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { generateWorld, WORLD_SIZE } from '../../src/sim/overworld/worldGen';
import { newWorld, orderTo, worldTick } from '../../src/sim/overworld/worldSim';

it('the world is the same for the same seed and different for another', () => {
  expect(generateWorld(4).ground).toEqual(generateWorld(4).ground);
  expect(generateWorld(4).ground).not.toEqual(generateWorld(5).ground);
});

it('camps sit on three rings round the base, stronger farther out, and every camp can be walked to', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const w = generateWorld(seed);
    expect(w.camps.length).toBeGreaterThanOrEqual(6);
    const d = distanceMap(w.map, w.map.start);
    for (const c of w.camps) {
      expect(d[idx(w.map, c.pos)]).toBeGreaterThan(0);
      const r = Math.hypot(c.pos.x - w.base.x, c.pos.y - w.base.y);
      expect(r).toBeGreaterThan(c.tier === 1 ? 15 : c.tier === 2 ? 26 : 36);
    }
    expect(w.map.w).toBe(WORLD_SIZE);
  }
});

it('the party starts by the ship on claimed land, sees only what is near, and the camps sleep', () => {
  const p = newWorld(undefined, 3);
  expect(p.claimed[idx(p.s.map, p.s.hero.pos)]).toBe(1);
  expect(p.s.visible.size).toBeLessThan(400);
  expect(p.units.filter((u) => u.side === 'foe').every((u) => u.asleep)).toBe(true);
  expect(p.combat).toBe(false);
});

it('out of combat an order walks the whole party there behind the chosen hero', () => {
  const p = newWorld(undefined, 3);
  const goal = { x: p.s.hero.pos.x + 5, y: p.s.hero.pos.y + 3 };
  orderTo(p, 'ally-1', goal);
  for (let i = 0; i < 200; i++) worldTick(p, 0.1);
  expect(entOf(p, 'ally-1')!.pos).toEqual(goal);
  expect(p.units.find((u) => u.id === 'ally-1')!.order).toBeNull();
  for (const id of ['hero', 'ally-2']) expect(dist(entOf(p, id)!.pos, goal)).toBeLessThanOrEqual(2);
});

it('walking up to a camp wakes it all at once and starts a fight; clearing it claims the land round it', () => {
  const p = newWorld(undefined, 3);
  const camp = p.camps[0]!;
  const band = p.units.filter((u) => u.group === camp.group);
  const spot = { x: camp.pos.x, y: camp.pos.y };
  for (const id of ['hero', 'ally-1', 'ally-2']) entOf(p, id)!.pos = { ...spot };
  entOf(p, 'hero')!.pos = { x: spot.x, y: spot.y };
  const ev = worldTick(p, 0.1);
  expect(band.every((u) => !u.asleep)).toBe(true);
  expect(ev.filter((e) => e.type === 'wake')).toHaveLength(1);
  expect(p.combat).toBe(true);
  for (const u of band) damage(p, p.time, 'hero', u, 999, []);
  const after = worldTick(p, 0.1);
  expect(camp.cleared).toBe(true);
  expect(p.claimed[idx(p.s.map, camp.pos)]).toBe(1);
  expect(after.some((e) => e.text === 'claim')).toBe(true);
});

it('a blow on one sleeping camp foe wakes its whole camp', () => {
  const p = newWorld(undefined, 3);
  const camp = p.camps[1]!;
  const band = p.units.filter((u) => u.group === camp.group);
  damage(p, 0, 'hero', band[0]!, 1, []);
  expect(band.every((u) => !u.asleep)).toBe(true);
});

it('left alone the party never throws over a long stretch of the world', () => {
  const p = newWorld(undefined, 9);
  orderTo(p, 'hero', p.camps[0]!.pos);
  for (let i = 0; i < 3000; i++) expect(() => worldTick(p, 0.1)).not.toThrow();
});
