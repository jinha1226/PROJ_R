import { expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { DOME, domeMax, domeR, planWave, raiders, REVIVE, reviveTime, rouseSiege, siegeTick, spawnRaider, WAVE_GAP } from '../../src/sim/base/siege';
import { ABSORB, BOUNTY, bountyOf, collectShards, dropShards, DROPS_MAX, fetchDrop, gunTick, PICKUP } from '../../src/sim/base/shards';
import { buyNode, canBuyNode, nodeCost, nodeOpen, TREE, treeLevel, WORTH, anyNodeAffordable } from '../../src/sim/base/tree';
import { departSurface, returnToSurface } from '../../src/sim/base/trips';
import { alive, damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { useUltimate } from '../../src/sim/party/ultimate';
import { takeClone, takeParty } from '../../src/sim/roam/carry';
import type { GEvent } from '../../src/sim/grid/types';

type P = ReturnType<typeof newSurface>;
/** the base with its clone holding its fire and too tough to fall */
const idle = (seed = 42) => { const p = newSurface(seed); for (const u of p.units) if (u.side === 'hero') { u.nextAt = 1e9; const e = entOf(p, u.id)!; e.hp = e.maxHp = 1e6; } return p; };
const run = (p: P, turns: number, step = 0.2) => { const ev: GEvent[] = []; for (let t = 0; t < turns; t += step) { p.time += step; p.siege!.domeHp = domeMax(p); siegeTick(p, step, ev); } return ev; };
const pour = (p: P, n: number) => { p.siege!.phase = 'wave'; p.siege!.wave = n; p.siege!.waveAt = p.time; for (const s of planWave(p, n, p.time)) spawnRaider(p, s, []); };
const centre = (p: P) => ({ x: p.base.x + 0.5, y: p.base.y + 0.5 });

it('a raider is worth more by its kind and its wave, and leaves that where it falls — far from the dome it lies there', () => {
  expect(bountyOf('fodder', 1)).toBe(1); expect(bountyOf('brute', 1)).toBe(6); expect(bountyOf('general', 1)).toBe(40);
  expect(bountyOf('fodder', 11)).toBeCloseTo(1.06 ** 10);
  const p = idle();
  pour(p, 5);
  const all = raiders(p), want = all.reduce((a, u) => a + u.bounty!, 0);
  expect(all.every((u) => u.bounty! > 0)).toBe(true);
  // they fall where they stepped out, far to the north: nothing is in reach of the dome or the clone
  for (const u of all) entOf(p, u.id)!.alive = false;
  run(p, 0.2);
  expect(p.shards).toBeCloseTo(BOUNTY.clear * 1.06 ** 4, 5);
  expect(p.drops!.reduce((a, d) => a + d.n, 0)).toBeCloseTo(want, 5);
  expect(p.drops!.every((d) => d.y < p.base.y - 10)).toBe(true);
});

it('shards near the dome\'s rim are drawn in; near a clone, picked up; the rest lie until someone comes — heaps on one spot are one heap', () => {
  const p = idle(), c = centre(p), r = domeR(p), me = entOf(p, 'hero')!;
  dropShards(p, c.x, c.y - (r + ABSORB - 0.2), 3);
  dropShards(p, c.x, c.y - (r + ABSORB + 4), 5);
  dropShards(p, c.x + 0.1, c.y - (r + ABSORB + 4), 2);
  expect(p.drops).toHaveLength(2); expect(p.drops![1]!.n).toBe(7);
  collectShards(p);
  expect(p.shards).toBe(3); expect(p.drops).toHaveLength(1);
  me.pos = { x: Math.round(c.x), y: Math.round(c.y - (r + ABSORB + 4) + PICKUP - 0.6) };
  collectShards(p);
  expect(p.shards).toBe(10); expect(p.drops).toHaveLength(0);
  // too many heaps are heaped together, none lost
  for (let k = 0; k < DROPS_MAX + 40; k++) dropShards(p, c.x - 9 + (k % 20), c.y - 12 - Math.floor(k / 20) * 0.5, 1);
  expect(p.drops!.length).toBeLessThanOrEqual(DROPS_MAX); expect(p.drops!.reduce((a, d) => a + d.n, 0)).toBe(DROPS_MAX + 40);
});

it('between waves a clone goes out for the shards lying about and is called back when a raider steps out', () => {
  const p = newSurface(42), c = centre(p), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let k = 0; k < 100; k++) worldTick(p, 0.2);
  expect(u.order?.kind).toBe('hold');
  dropShards(p, c.x, c.y - 11, 4); dropShards(p, c.x + 2, c.y - 12, 6);
  expect(fetchDrop(p, me.pos, new Set())?.n).toBe(4);
  for (let k = 0; k < 400 && p.drops!.length; k++) worldTick(p, 0.2);
  expect(p.drops).toHaveLength(0); expect(p.shards).toBe(10);
  // home again
  for (let k = 0; k < 200; k++) worldTick(p, 0.2);
  expect(u.order?.kind).toBe('hold'); expect(Math.hypot(me.pos.x - c.x, me.pos.y - c.y)).toBeLessThan(domeR(p));
  // a wave out: it stays at its place, whatever lies in the field
  dropShards(p, c.x, c.y - 12, 9);
  pour(p, 1); for (const f of raiders(p)) { const e = entOf(p, f.id)!; e.hp = e.maxHp = 1e6; }
  me.hp = me.maxHp = 1e6; p.siege!.domeHp = 1e9;
  for (let k = 0; k < 60; k++) { p.siege!.domeHp = 1e9; worldTick(p, 0.2); }
  expect(p.drops).toHaveLength(1); expect(Math.hypot(me.pos.x - c.x, me.pos.y - c.y)).toBeLessThan(domeR(p));
});

it('a cleared wave pays its prize and the pace the base earns at is taken; the readings follow what comes in and what is dealt', () => {
  const p = idle(), s = p.siege!;
  rouseSiege(p); run(p, 56);
  expect(s.wave).toBe(1); expect(p.siegeQueue).toHaveLength(0);
  for (const u of raiders(p)) damage(p, p.time, 'hero', u, 999, [], true);
  const ev = run(p, 0.4);
  expect(ev.find((e) => e.text === 'waveClear:1')?.amount).toBe(5);
  expect(p.shards).toBeGreaterThanOrEqual(5); expect(s.pace).toBeGreaterThan(0);
  expect(s.dps).toBeGreaterThan(0); expect(s.income).toBeGreaterThan(0);
  const [dps, income] = [s.dps!, s.income!];
  run(p, WAVE_GAP - 2); expect(s.dps).toBeLessThan(dps); expect(s.income).toBeLessThan(income);
});

it('the tree: thirteen nodes in three branches; a price grows 1.15 a level; a node opens when the one before is far enough; some have a last level', () => {
  expect(TREE).toHaveLength(13); expect(new Set(TREE.map((n) => n.branch))).toEqual(new Set(['dome', 'clone', 'income']));
  const p = newSurface(42);
  expect(anyNodeAffordable(p)).toBe(false); expect(buyNode(p, 'domeHp')).toBe(false);
  p.shards = 1000;
  expect(nodeCost(p, 'domeHp')).toBe(10); expect(nodeOpen(p, 'gun')).toBe(false); expect(canBuyNode(p, 'gun')).toBe(false);
  expect(buyNode(p, 'domeHp')).toBe(true); expect(p.shards).toBe(990); expect(nodeCost(p, 'domeHp')).toBe(12);
  expect(buyNode(p, 'domeHp')).toBe(true); expect(treeLevel(p, 'domeHp')).toBe(2); expect(nodeCost(p, 'domeHp')).toBe(13);
  expect(nodeOpen(p, 'gun')).toBe(true); expect(buyNode(p, 'gun')).toBe(true); expect(nodeOpen(p, 'domeRegen')).toBe(true);
  // every line of the tree can be told at any level; roots are open from the start
  for (const n of TREE) { expect(n.what.length).toBeGreaterThan(0); expect(n.val(1).length).toBeGreaterThan(0); expect(n.val(7)).not.toContain('NaN'); if (!n.needs) expect(nodeOpen(p, n.id)).toBe(true); else expect(TREE.find((o) => o.id === n.needs![0])!.branch).toBe(n.branch); }
  p.shards = 1e12; p.tree = { ...p.tree, gunRate: 3, domeSize: 5 };
  expect(buyNode(p, 'domeSize')).toBe(true); expect(nodeCost(p, 'domeSize')).toBeUndefined(); expect(buyNode(p, 'domeSize')).toBe(false);
  expect(WORTH.cloneGuard(99)).toBe(0.4); expect(WORTH.cloneUlt(99)).toBe(0.5); expect(WORTH.away(99)).toBe(1); expect(WORTH.away(0)).toBe(0.5);
});

it('what the tree gives is what the base has: the dome\'s strength, mending and reach; a fallen clone\'s wait; the clones\' blows, hide and ultimates', () => {
  const p = idle(), s = p.siege!, u = unitOf(p, 'hero')!;
  expect([domeMax(p), domeR(p), reviveTime(p)]).toEqual([DOME.hp, DOME.r, REVIVE]);
  p.tree = { domeHp: 5, domeRegen: 4, domeSize: 2, cloneRevive: 30, cloneDmg: 10, cloneGuard: 5, cloneUlt: 5 };
  expect(domeMax(p)).toBe(Math.round(DOME.hp * 1.12 ** 5)); expect(domeR(p)).toBe(DOME.r + 1); expect(reviveTime(p)).toBeCloseTo(3 * 3.6);
  s.domeHp = 10; p.time += 1; siegeTick(p, 1, []);
  expect(s.domeHp).toBeCloseTo(10 + DOME.regen * 1.1 ** 4, 5);
  expect(p.boost).toEqual({ out: 1.06 ** 10, taken: 0.8, ult: 0.8 });
  // a blow on a raider is worth more, a blow on a clone less; an ultimate comes back sooner
  pour(p, 1);
  const foe = raiders(p)[0]!, fe = entOf(p, foe.id)!, me = entOf(p, 'hero')!;
  fe.hp = fe.maxHp = 1000; damage(p, p.time, 'hero', foe, 100, []);
  expect(1000 - fe.hp).toBe(Math.round(100 * 1.06 ** 10));
  me.hp = me.maxHp = 1000; u.shield = 0; damage(p, p.time, foe.id, u, 100, []);
  const taken = 1000 - me.hp;
  p.boost = undefined; me.hp = 1000; damage(p, p.time, foe.id, u, 100, []);
  expect(taken).toBe(Math.round((1000 - me.hp) * 0.8));
  p.boost = { out: 1, taken: 1, ult: 0.8 }; u.nextAt = 0; u.ultReady = 0;
  const cast = useUltimate(p, 'hero', { ...fe.pos });
  if (cast.length) expect(u.ultReady - p.time).toBeCloseTo(35 * 0.8, 1);
});

it('the dome\'s gun: none until its node is taken; then a shot at the nearest raider in reach, leaping on with the chain', () => {
  const p = idle(), s = p.siege!, c = centre(p);
  pour(p, 3);
  const put = (k: number, dy: number) => { const f = raiders(p)[k]!, e = entOf(p, f.id)!; e.hp = e.maxHp = 100; e.pos = { x: p.base.x, y: p.base.y - dy }; f.sx = p.base.x + 0.5 + k * 0.4; f.sy = p.base.y - dy + 0.5; return e; };
  const near = put(0, 7), next = put(1, 8), third = put(2, 9);
  for (const f of raiders(p).slice(3)) entOf(p, f.id)!.alive = false;
  let ev: GEvent[] = [];
  gunTick(p, ev); expect(ev).toHaveLength(0);
  p.tree = { gun: 1 };
  gunTick(p, ev);
  expect(near.hp).toBe(94); expect(next.hp).toBe(100); expect(ev.filter((e) => e.text === 'domeShot')).toHaveLength(1);
  expect(ev.find((e) => e.text === 'domeShot')!.from).toEqual(c);
  // not again until its time has come
  gunTick(p, ev); expect(near.hp).toBe(94);
  p.time = s.gunAt!; p.tree = { gun: 3, gunChain: 2 }; ev = [];
  gunTick(p, ev);
  expect([near.hp, next.hp, third.hp]).toEqual([94 - 8, 92, 92]); expect(ev.filter((e) => e.text === 'domeShot')).toHaveLength(3);
  expect(s.gunAt).toBeCloseTo(p.time + 2 * 3.6);
  // out of reach: it holds its fire (and its time)
  for (const e of [near, next, third]) e.pos = { x: p.base.x, y: p.base.y - 17 };
  for (const f of raiders(p).slice(0, 3)) f.sy = p.base.y - 17;
  p.time = s.gunAt!; const at = s.gunAt; gunTick(p, []); expect(s.gunAt).toBe(at);
  expect(alive(p, raiders(p)[0]!)).toBe(true);
});

it('while a clone is below the base goes on earning a share of its pace — when its siege is running', () => {
  const p = newSurface(42), s = p.siege!;
  rouseSiege(p); s.pace = 2;
  const d = departSurface(p, 5, takeClone(p, 'hero'))!;
  d.time += 100;
  const ev = returnToSurface(p, takeParty(d));
  expect(p.shards).toBeCloseTo(2 * 100 * 0.5); expect(ev.find((e) => e.text === 'awayShards')?.amount).toBe(100);
  p.tree = { away: 4 }; p.shards = 0;
  const d2 = departSurface(p, 6, takeClone(p, 'hero'))!; d2.time += 50;
  returnToSurface(p, takeParty(d2));
  expect(p.shards).toBeCloseTo(2 * 50 * 0.7);
  // stopped at a broken dome, it earns nothing
  s.phase = 'held'; p.shards = 0;
  const d3 = departSurface(p, 7, takeClone(p, 'hero'))!; d3.time += 50;
  returnToSurface(p, takeParty(d3));
  expect(p.shards).toBe(0);
});
