import { expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { raidSize, startRaid } from '../../src/sim/base/raids';
import { raidField } from '../../src/sim/base/raidPath';
import { swarmTick } from '../../src/sim/base/swarm';
import { buildingsAt, canPlace, place } from '../../src/sim/base/buildings';
import { damage, entOf, occupied } from '../../src/sim/party/partyCore';
import { action } from '../../src/sim/party/triggers';
import { idx, tileAt, walkable } from '../../src/sim/grid/types';

/** a raid with every clone parked out of the way (the horde runs by itself) */
const raid = (seed = 42) => {
  const p = newSurface(seed); p.ore = 400; p.raidsDone = 0; p.deepest = 1;
  // the clones stand aside, too tough to fall (the raid is lost only when the test says so)
  for (const u of p.units) if (u.side === 'hero') { u.nextAt = 1e9; const e = entOf(p, u.id)!; e.hp = e.maxHp = 1e6; }
  startRaid(p);
  return p;
};
const fodder = (p: ReturnType<typeof raid>) => p.units.filter((u) => u.swarm && entOf(p, u.id)?.alive);
const run = (p: ReturnType<typeof raid>, turns: number, step = 0.1) => { for (let t = 0; t < turns; t += step) { p.time += step; swarmTick(p, step, []); } };

it('a raid is 60 to 150 strong, growing with raids done and depth', () => {
  const p = newSurface(42); p.raidsDone = 0; p.deepest = 1;
  expect(raidSize(p)).toBe(60);
  p.raidsDone = 3; p.deepest = 9; expect(raidSize(p)).toBeGreaterThan(60);
  p.raidsDone = 40; expect(raidSize(p)).toBe(150);
});

it('the horde pours out in waves over time: the whole size in the end, fodder flagged and never taking turns', () => {
  const p = raid();
  expect(fodder(p).length).toBeLessThan(raidSize(p));
  run(p, 40);
  const all = p.units.filter((u) => u.group === p.raid!.group);
  expect(all.length).toBe(raidSize(p));
  for (const f of all.filter((u) => u.swarm)) { expect(f.nextAt).toBe(Infinity); expect(entOf(p, f.id)!.swarm).toBe(true); }
  expect(all.some((u) => u.foe === 'warlord')).toBe(true);
});

it('fodder never stand in a wall, a building or off the map, and several may share a cell', () => {
  const p = raid(), m = p.s.map;
  run(p, 30);
  const cells = new Map<number, number>();
  for (const f of fodder(p)) {
    const c = entOf(p, f.id)!.pos;
    expect(c.x).toBe(Math.floor(f.sx!)); expect(c.y).toBe(Math.floor(f.sy!));
    expect(walkable(tileAt(m, c)) || !!buildingsAt(p, c)).toBe(true);
    expect(buildingsAt(p, c)).toBeUndefined();
    cells.set(idx(m, c), (cells.get(idx(m, c)) ?? 0) + 1);
  }
  expect(Math.max(...cells.values())).toBeGreaterThan(1);
  // clones walk through the crowd
  const f = fodder(p)[0]!;
  expect(occupied(p, entOf(p, f.id)!.pos, 'hero')).toBe(false);
});

it('the horde reaches the pod and hacks at it', () => {
  const p = raid();
  const hp = p.podHp;
  run(p, 120, 0.2);
  expect(p.podHp).toBeLessThan(hp);
});

it('a full ring of walls round the pod is broken through', () => {
  const p = newSurface(42); p.ore = 900;
  for (const u of p.units) if (u.side === 'hero') u.nextAt = 1e9;
  for (let dy = -4; dy <= 5; dy++) for (let dx = -4; dx <= 5; dx++) if (Math.max(Math.abs(dx - 0.5), Math.abs(dy - 0.5)) >= 4 && canPlace(p, 'wall', { x: p.base.x + dx, y: p.base.y + dy })) place(p, 'wall', { x: p.base.x + dx, y: p.base.y + dy });
  const walls = p.buildings.length;
  startRaid(p);
  expect(Number.isFinite(raidField(p)[idx(p.s.map, { x: 2, y: p.base.y })]!) || Number.isFinite(raidField(p)[idx(p.s.map, { x: p.s.map.w - 3, y: p.base.y })]!)).toBe(true);
  const hp = p.podHp;
  run(p, 300, 0.25);
  expect(p.buildings.length).toBe(walls); expect(p.buildings.some((b) => b.broken)).toBe(true); expect(p.podHp).toBeLessThan(hp);
});

it('a blast through the ordinary damage kills the fodder in its cells', () => {
  const p = raid();
  run(p, 15);
  const f = fodder(p)[0]!;
  action(p, () => damage(p, p.time, 'hero', f, 9999, [], true));
  expect(entOf(p, f.id)!.alive).toBe(false);
});

it('kills pay materials, kept on a loss, and the result names them', () => {
  const p = raid();
  run(p, 20);
  const ore = p.ore, few = fodder(p).slice(0, 5);
  for (const f of few) entOf(p, f.id)!.alive = false;
  worldTick(p, 0.05);
  expect(p.raidLoot!.kills).toBeGreaterThanOrEqual(5); expect(p.ore).toBeGreaterThan(ore);
  const kept = p.ore;
  p.podHp = 0; worldTick(p, 0.05);
  expect(p.raid).toBeNull(); expect(p.lastRaid!.won).toBe(false); expect(p.lastRaid!.kills).toBeGreaterThanOrEqual(5);
  expect(p.ore).toBeGreaterThanOrEqual(kept - Math.floor(kept * 0.3));
});

it('a tick of a 150-strong horde stays cheap', () => {
  const p = newSurface(42); p.raidsDone = 40; p.deepest = 12;
  for (const u of p.units) if (u.side === 'hero') u.nextAt = 1e9;
  startRaid(p); run(p, 40);
  const t0 = performance.now(); for (let k = 0; k < 30; k++) { p.time += 0.1; swarmTick(p, 0.1, []); }
  expect((performance.now() - t0) / 30).toBeLessThan(6);
});
