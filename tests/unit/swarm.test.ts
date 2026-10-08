import { expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { raidPlan, raidSize, startRaid } from '../../src/sim/base/raids';
import { hitTarget, raidField, roadOpen, targetNear, targets } from '../../src/sim/base/raidPath';
import { footprint, MODULE_HP, moduleOf } from '../../src/sim/base/modules';
import { BLOWS, PAY_EVERY, planWaves, swarmTick, WAVE_GAP, WAVE_POUR } from '../../src/sim/base/swarm';
import { buildingsAt, place, POD_MAX } from '../../src/sim/base/buildings';
import { setPost } from '../../src/sim/base/posts';
import { damage, entOf, occupied } from '../../src/sim/party/partyCore';
import { action } from '../../src/sim/party/triggers';
import { ringLayout } from '../../src/ui/demo/raidDemo';
import { dist, idx, same, tileAt, walkable, type GEvent } from '../../src/sim/grid/types';

/** the pod alone on its ground (the modules taken away: most of these are about the horde and the pod) */
const bare = (p: ReturnType<typeof newSurface>) => { for (const m of p.modules ?? []) for (const c of footprint(m.at)) p.s.map.tiles[idx(p.s.map, c)] = 'floor'; p.modules = []; return p; };
/** a raid with every clone too tough to fall and holding its fire (the horde runs by itself); `whole`: the modules stay */
const raid = (seed = 42, prep?: (p: ReturnType<typeof newSurface>) => void, whole = false) => {
  const p = newSurface(seed); p.raidsDone = 0;
  if (!whole) bare(p);
  prep?.(p);
  startRaid(p);
  for (const u of p.units) if (u.side === 'hero') { u.nextAt = 1e9; const e = entOf(p, u.id)!; e.hp = e.maxHp = 1e6; }
  return p;
};
const fodder = (p: ReturnType<typeof raid>) => p.units.filter((u) => u.swarm && entOf(p, u.id)?.alive);
const run = (p: ReturnType<typeof raid>, turns: number, step = 0.1) => { for (let t = 0; t < turns; t += step) { p.time += step; swarmTick(p, step, []); } };

it('the waves: one every gap, each pouring out over a while, from many cells; elites among the fodder and the general last when the plan has them', () => {
  const cells = Array.from({ length: 14 }, (_, k) => ({ x: k, y: 0 }));
  const plan = planWaves({ size: 200, waves: 5, eliteEvery: 20, general: true }, cells, 10);
  expect(plan).toHaveLength(200);
  expect(plan[0]!.at).toBe(10); expect(plan[plan.length - 1]!.at).toBeLessThanOrEqual(10 + 4 * WAVE_GAP + WAVE_POUR);
  expect(new Set(plan.map((s) => `${s.cell.x}`)).size).toBe(14);
  expect(plan.filter((s) => s.kind === 'general')).toHaveLength(1); expect(plan[plan.length - 1]!.kind).toBe('general');
  expect(plan.some((s) => s.kind === 'brute')).toBe(true); expect(plan.some((s) => s.kind === 'archer')).toBe(true);
  // most of the fodder leave nothing behind
  const f = plan.filter((s) => s.kind === 'fodder');
  expect(f.filter((s) => !s.lean).length).toBeLessThanOrEqual(Math.ceil(200 / PAY_EVERY)); expect(f.some((s) => !s.lean)).toBe(true);
  expect(planWaves({ size: 80, waves: 4, eliteEvery: 0, general: false }, cells, 0).every((s) => s.kind === 'fodder')).toBe(true);
});

it('the horde pours out over time: the whole size in the end, fodder flagged and never taking turns', () => {
  const p = raid(), size = p.raid!.size;
  expect(size).toBe(raidSize(newSurface(42)));
  expect(fodder(p).length).toBeLessThan(size);
  run(p, raidPlan(p, size).waves * WAVE_GAP, 0.25);
  const all = p.units.filter((u) => u.group === p.raid!.group);
  expect(all.length).toBe(size);
  for (const f of all.filter((u) => u.swarm)) { expect(f.nextAt).toBe(Infinity); expect(entOf(p, f.id)!.swarm).toBe(true); expect(f.raider).toBe(true); }
});

it('fodder never stand in rock, a barricade, a clone\'s cell or off the map, and several may share a cell', () => {
  const p = raid(42, (q) => { for (let x = q.base.x - 3; x <= q.base.x + 4; x++) place(q, { x, y: q.base.y - 4 }); }), m = p.s.map;
  const hero = entOf(p, 'hero')!.pos;
  const cells = new Map<number, number>();
  for (let k = 0; k < 40; k++) {
    run(p, 2);
    for (const f of fodder(p)) {
      const c = entOf(p, f.id)!.pos;
      expect(c.x).toBe(Math.floor(f.sx!)); expect(c.y).toBe(Math.floor(f.sy!));
      expect(walkable(tileAt(m, c))).toBe(true); expect(buildingsAt(p, c)).toBeUndefined(); expect(same(c, hero)).toBe(false);
      cells.set(idx(m, c), (cells.get(idx(m, c)) ?? 0) + 1);
    }
  }
  expect(Math.max(...cells.values())).toBeGreaterThan(1);
  // the crowd is no obstacle to a clone's own steps
  const f = fodder(p)[0]!;
  expect(occupied(p, entOf(p, f.id)!.pos, 'hero')).toBe(false);
});

it('with the road open the horde reaches the pod and chips at it: a point a blow, the front rank only', () => {
  const p = raid();
  expect(roadOpen(p, { x: p.base.x - 10, y: p.base.y })).toBe(true);
  run(p, 40, 0.2);
  const hp = p.podHp;
  expect(hp).toBeLessThan(POD_MAX);
  run(p, 10, 0.2);
  expect(hp - p.podHp).toBeGreaterThan(0); expect(hp - p.podHp).toBeLessThanOrEqual(BLOWS * 10 + BLOWS);
});

it('an open road is followed however long: a wall with one gap far to the side is walked round, never broken', () => {
  // a line of barricades north of the pod, open at its ends: the horde from the north goes round
  const p = raid(42, (q) => { for (let x = q.base.x - 5; x <= q.base.x + 6; x++) place(q, { x, y: q.base.y - 3 }); });
  expect(p.buildings.length).toBe(12);
  const north = { x: p.base.x, y: p.base.y - 6 };
  expect(roadOpen(p, north)).toBe(true);
  expect(raidField(p)[idx(p.s.map, north)]!).toBeGreaterThan(dist(north, p.base));
  run(p, 150, 0.2);
  expect(p.buildings.every((b) => !b.broken && b.hp === b.maxHp)).toBe(true); expect(p.podHp).toBeLessThan(POD_MAX);
});

it('a base sealed by barricades and a clone is stormed at the clone: the barricades stand, the pod and the modules are untouched while it lives', () => {
  const p = raid(42, ringLayout, true);
  expect(p.buildings.length).toBe(19);
  expect(roadOpen(p, { x: p.base.x - 10, y: p.base.y })).toBe(false);
  const e = entOf(p, 'hero')!, hp = e.hp;
  run(p, 150, 0.2);
  expect(e.hp).toBeLessThan(hp); expect(p.podHp).toBe(POD_MAX); expect(p.buildings.every((b) => !b.broken)).toBe(true);
  expect(moduleOf(p, 'lab')!.hp).toBe(MODULE_HP); expect(moduleOf(p, 'quarters')!.hp).toBe(MODULE_HP);
  // the horde piles up before it
  expect(fodder(p).filter((f) => dist(entOf(p, f.id)!.pos, e.pos) <= 3).length).toBeGreaterThan(10);
  // the clone falls: its cell opens and the horde is through
  e.alive = false;
  run(p, 20, 0.2);
  expect(p.podHp + moduleOf(p, 'lab')!.hp + moduleOf(p, 'quarters')!.hp).toBeLessThan(POD_MAX + 2 * MODULE_HP);
});

it('the horde makes for whatever of ours is nearest: a module left outside is hacked down (the front rank only), then the next thing', () => {
  const p = raid(42, undefined, true), lab = moduleOf(p, 'lab')!, shop = moduleOf(p, 'workshop')!;
  // a wreck is nothing to a raid: the workshop came down broken
  expect(targets(p).map((t) => t.id)).toEqual(['pod', 'module-lab', 'module-quarters']);
  expect(targetNear(p, { x: lab.at.x - 1, y: lab.at.y })).toBe('module-lab'); expect(targetNear(p, { x: shop.at.x - 1, y: shop.at.y - 1 })).toBeUndefined();
  run(p, 40, 0.2);
  const a = lab.hp + moduleOf(p, 'quarters')!.hp;
  expect(a).toBeLessThan(2 * MODULE_HP);
  run(p, 5, 0.2);
  expect(a - lab.hp - moduleOf(p, 'quarters')!.hp).toBeLessThanOrEqual(2 * (BLOWS * 5 + BLOWS));
  // broken, it is left alone and stays in the way
  const ev: GEvent[] = [];
  hitTarget(p, 'module-lab', 9999, 'x', ev);
  expect(lab.broken).toBe(true); expect(ev.some((x) => x.type === 'die' && x.dst === 'module-lab')).toBe(true);
  expect(targets(p).some((t) => t.id === 'module-lab')).toBe(false); expect(p.s.map.tiles[idx(p.s.map, lab.at)]).toBe('chasm');
  const hp = lab.hp; hitTarget(p, 'module-lab', 5, 'x', ev); expect(lab.hp).toBe(hp);
});

it('a posted clone is a wall wherever it stands: the field goes round it', () => {
  const p = newSurface(42), at = { x: p.base.x - 6, y: p.base.y };
  const before = raidField(p)[idx(p.s.map, at)]!;
  setPost(p, 'hero', at); startRaid(p);
  expect(same(entOf(p, 'hero')!.pos, at)).toBe(true);
  expect(raidField(p)[idx(p.s.map, at)]!).toBeGreaterThan(before + 100);
  expect(roadOpen(p, { x: at.x - 1, y: at.y })).toBe(true);
});

it('a blast through the ordinary damage kills the fodder in its cells', () => {
  const p = raid();
  run(p, 15);
  const f = fodder(p)[0]!;
  action(p, () => damage(p, p.time, 'hero', f, 9999, [], true));
  expect(entOf(p, f.id)!.alive).toBe(false);
});

it('kills pay little (most fodder nothing), kept on a loss, and the result names them', () => {
  const p = raid();
  run(p, 20);
  const ore = p.ore, bio = p.bio, all = fodder(p);
  expect(all.length).toBeGreaterThan(PAY_EVERY);
  for (const f of all) entOf(p, f.id)!.alive = false;
  worldTick(p, 0.05);
  const paid = all.filter((f) => !f.lean).length;
  expect(p.raidLoot!.kills).toBe(all.length); expect(paid).toBeLessThan(all.length / 4);
  expect(p.ore - ore).toBe(paid); expect(p.bio - bio).toBe(paid);
  const kept = p.ore;
  p.podHp = 0; worldTick(p, 0.05);
  expect(p.raid).toBeNull(); expect(p.lastRaid!.won).toBe(false); expect(p.lastRaid!.kills).toBe(all.length); expect(p.ore).toBe(kept);
});

it('a tick of a horde at its largest stays cheap', () => {
  const p = bare(newSurface(42)); p.raidsDone = 40;
  startRaid(p);
  for (const u of p.units) if (u.side === 'hero') { u.nextAt = 1e9; const e = entOf(p, u.id)!; e.hp = e.maxHp = 1e6; }
  // the whole horde out at once (the waves would take minutes of game time to get there), then on its way in
  for (const s of p.raidQueue!) s.at = p.time;
  run(p, 12, 0.25);
  expect(fodder(p).length).toBeGreaterThan(300);
  const t0 = performance.now(); for (let k = 0; k < 30; k++) { p.time += 0.1; swarmTick(p, 0.1, []); }
  expect((performance.now() - t0) / 30).toBeLessThan(8);
}, 30_000);
