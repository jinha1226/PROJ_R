import { expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { callWave, DOME, domeCap, MEND, domeMax, domeR, domeUp, FRONT_GUARD, hitDome, planWave, raiders, REVIVE, reviveTime, rouseSiege, siegeTick, spawnRaider, WAVE_GAP } from '../../src/sim/base/siege';
import { ABSORB, BOUNTY, bountyOf, collectShards, dropShards, DROPS_MAX, fetchDrop, gunTick, PICKUP, streakMult, waveCleared } from '../../src/sim/base/shards';
import { buyNode, canBuyNode, nodeCost, nodeOpen, TREE, treeLevel, WORTH, anyNodeAffordable } from '../../src/sim/base/tree';
import { departSurface, returnToSurface } from '../../src/sim/base/trips';
import { alive, damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { useUltimate } from '../../src/sim/party/ultimate';
import { takeClone, takeParty } from '../../src/sim/roam/carry';
import { implant } from '../../src/sim/roam/roam';
import type { GEvent } from '../../src/sim/grid/types';

type P = ReturnType<typeof newSurface>;
/** the base with its clone holding its fire and too tough to fall */
const idle = (seed = 42) => { const p = newSurface(seed); for (const u of p.units) if (u.side === 'hero') { u.nextAt = 1e9; const e = entOf(p, u.id)!; e.hp = e.maxHp = 1e6; } return p; };
const run = (p: P, turns: number, step = 0.2) => { const ev: GEvent[] = []; for (let t = 0; t < turns; t += step) { p.time += step; p.siege!.domeHp = domeMax(p); siegeTick(p, step, ev); } return ev; };
const pour = (p: P, n: number) => { p.siege!.phase = 'wave'; p.siege!.wave = n; p.siege!.waveAt = p.time; for (const s of planWave(p, n, p.time)) spawnRaider(p, s, []); };
const centre = (p: P) => ({ x: p.base.x + 0.5, y: p.base.y + 0.5 });

it('a raider is worth more by its kind and its wave, and leaves that where it falls — far from the dome it lies there', () => {
  expect(bountyOf('fodder', 1)).toBe(BOUNTY.fodder); expect(bountyOf('brute', 1)).toBe(BOUNTY.elite); expect(bountyOf('general', 1)).toBe(BOUNTY.general);
  expect(BOUNTY.elite).toBeGreaterThan(BOUNTY.fodder * 4); expect(bountyOf('fodder', 11)).toBeCloseTo(BOUNTY.fodder * BOUNTY.growth ** 10);
  const p = idle();
  pour(p, 5);
  const all = raiders(p), want = all.reduce((a, u) => a + u.bounty!, 0);
  expect(all.every((u) => u.bounty! > 0)).toBe(true);
  // they fall where they stepped out, far to the north: nothing is in reach of the dome or the clone
  for (const u of all) entOf(p, u.id)!.alive = false;
  run(p, 0.2);
  expect(p.shards).toBeCloseTo(BOUNTY.clear * BOUNTY.growth ** 4, 5);
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
  expect(ev.find((e) => e.text === 'waveClear:1')?.amount).toBe(BOUNTY.clear);
  expect(p.shards).toBeGreaterThanOrEqual(BOUNTY.clear); expect(s.pace).toBeGreaterThan(0);
  expect(s.dps).toBeGreaterThan(0); expect(s.income).toBeGreaterThan(0);
  const [dps, income] = [s.dps!, s.income!];
  run(p, WAVE_GAP - 2); expect(s.dps).toBeLessThan(dps); expect(s.income).toBeLessThan(income);
});

it('the tree: twenty-seven nodes in five branches, each growing from the core or from a node of its own branch; a price grows by its node\'s rate; a node opens when the one before is far enough; most have a last level', () => {
  expect(TREE).toHaveLength(27); expect(new Set(TREE.map((n) => n.id)).size).toBe(27);
  const count = (b: string) => TREE.filter((n) => n.branch === b).length;
  expect([count('dome'), count('gun'), count('support'), count('income'), count('auto')]).toEqual([7, 7, 5, 7, 1]);
  // only five plain numbers rise without end; nothing in the tree is a clone's own strength
  expect(TREE.filter((n) => n.max === undefined).map((n) => n.id).sort()).toEqual(['bounty', 'domeHp', 'domeRegen', 'gun', 'gunRate']);
  const p = newSurface(42);
  expect(anyNodeAffordable(p)).toBe(false); expect(buyNode(p, 'domeHp')).toBe(false);
  p.shards = 1000;
  expect(nodeCost(p, 'domeHp')).toBe(10); expect(nodeOpen(p, 'domeRegen')).toBe(false); expect(canBuyNode(p, 'domeRegen')).toBe(false);
  expect(buyNode(p, 'domeHp')).toBe(true); expect(p.shards).toBe(990); expect(nodeCost(p, 'domeHp')).toBe(13);
  expect(buyNode(p, 'domeHp')).toBe(true); expect(treeLevel(p, 'domeHp')).toBe(2); expect(nodeCost(p, 'domeHp')).toBe(16);
  expect(nodeOpen(p, 'domeRegen')).toBe(true); expect(nodeOpen(p, 'thorns')).toBe(false);
  // a node with a last level grows dearer faster
  expect(nodeCost(p, 'cloneRevive')).toBe(25); p.tree = { ...p.tree, cloneRevive: 2 }; expect(nodeCost(p, 'cloneRevive')).toBe(Math.round(25 * 1.25 ** 2));
  for (const n of TREE) {
    expect(n.what.length).toBeGreaterThan(0); expect(n.desc.length).toBeGreaterThan(0); expect(n.val(1).length).toBeGreaterThan(0); expect(n.val(n.max ?? 7)).not.toContain('NaN');
    if (!n.needs) { expect(nodeOpen(p, n.id)).toBe(true); expect(n.at[0]).toBe(1); }
    else { const from = TREE.find((o) => o.id === n.needs![0])!; expect(from.branch).toBe(n.branch); expect(n.at[0]).toBeGreaterThan(from.at[0]); expect(n.needs[1]).toBeLessThanOrEqual(from.max ?? 99); }
  }
  p.shards = 1e12; p.tree = { ...p.tree, grace: 0, domeSize: 5 };
  expect(buyNode(p, 'domeSize')).toBe(true); expect(nodeCost(p, 'domeSize')).toBeUndefined(); expect(buyNode(p, 'domeSize')).toBe(false);
  expect(WORTH.cloneUlt(99)).toBe(0.5); expect(WORTH.away(99)).toBe(1); expect(WORTH.away(0)).toBe(0.5); expect(WORTH.gunRate(999)).toBeCloseTo(0.25 * 3.6);
  expect([WORTH.autoRestart(0), WORTH.autoRestart(1), WORTH.autoRestart(3)]).toEqual([0, 36, 3 * 3.6]);
});

it('what the tree gives is what the base has: the dome\'s strength, mending, reach and overcharge; a fallen clone\'s wait; how fast a clone mends inside and how far a melee one goes out; an ultimate\'s wait', () => {
  const p = idle(), s = p.siege!, u = unitOf(p, 'hero')!;
  expect([domeMax(p), domeR(p), reviveTime(p), domeCap(p)]).toEqual([DOME.hp, DOME.r, REVIVE, DOME.hp]);
  p.tree = { domeHp: 5, domeRegen: 4, domeSize: 2, cloneRevive: 22, cloneUlt: 5, overcharge: 2 };
  expect(domeMax(p)).toBe(Math.round(DOME.hp * 1.12 ** 5)); expect(domeR(p)).toBe(DOME.r + 1); expect(reviveTime(p)).toBeCloseTo(REVIVE * 0.94 ** 22);
  s.domeHp = 10; p.time += 1; siegeTick(p, 1, []);
  expect(s.domeHp).toBeCloseTo(10 + DOME.regen * 1.1 ** 4, 5);
  // past full it goes on filling, at half the pace, up to a fifth over
  const max = domeMax(p); expect(domeCap(p)).toBe(Math.round(max * 1.2));
  s.domeHp = max; p.time += 1; siegeTick(p, 1, []);
  expect(s.domeHp).toBeCloseTo(max + (DOME.regen * 1.1 ** 4) / 2, 5);
  for (let k = 0; k < 400; k++) { p.time += 1; siegeTick(p, 1, []); }
  expect(s.domeHp).toBe(domeCap(p));
  expect(p.boost).toEqual({ ult: 0.8 });
  // a blow is a blow: the tree does not make a clone hit harder or take less
  pour(p, 1);
  const foe = raiders(p)[0]!, fe = entOf(p, foe.id)!;
  fe.hp = fe.maxHp = 1000; damage(p, p.time, 'hero', foe, 100, []);
  expect(1000 - fe.hp).toBe(100);
  u.nextAt = 0; u.ultReady = 0;
  const cast = useUltimate(p, 'hero', { ...fe.pos });
  if (cast.length) expect(u.ultReady - p.time).toBeCloseTo(35 * 0.8, 1);
});

it('a clone under the dome mends faster with the medbay; a melee clone goes out farther with the front line', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  u.souls = []; implant(p, u, 'warrior', []);
  for (let k = 0; k < 150; k++) worldTick(p, 0.2);
  expect(u.order).toMatchObject({ kind: 'hold', guard: FRONT_GUARD });
  p.tree = { frontLine: 2 };
  for (let k = 0; k < 10; k++) worldTick(p, 0.2);
  expect(u.order).toMatchObject({ kind: 'hold', guard: FRONT_GUARD + 2 });
  const q = newSurface(42), qe = entOf(q, 'hero')!, mend = (lv: number) => { q.tree = { medbay: lv }; qe.hp = 10; worldTick(q, 1); return qe.hp - 10; };
  for (let k = 0; k < 100; k++) worldTick(q, 0.2);
  const plain = mend(0);
  // (whatever else mends it in that turn is the same both times: the medbay's two levels double the dome's own share)
  expect(plain).toBeGreaterThan(0); expect(mend(2) - plain).toBeCloseTo(qe.maxHp * MEND, 5);
  expect(e.alive).toBe(true);
});

it('thorns cost a raider its own health for each blow on the dome; the emergency charge and the last stand each save it once a wave', () => {
  const p = idle(), s = p.siege!;
  pour(p, 5);
  const f = raiders(p).find((u) => u.fodder)!, fe = entOf(p, f.id)!, b = raiders(p).find((u) => !u.fodder)!, be = entOf(p, b.id)!;
  fe.hp = fe.maxHp = 100; be.hp = be.maxHp = 100;
  hitDome(p, 1, f.id, p.base, []); expect(fe.hp).toBe(100);
  p.tree = { thorns: 3 };
  hitDome(p, 1, f.id, p.base, []); hitDome(p, 1, b.id, p.base, []);
  expect(fe.hp).toBe(91); expect(be.hp).toBe(95); expect(s.domeHit).toBe(true);
  // under three tenths: two fifths of its strength back, once
  p.tree = { emergency: 2 }; const max = domeMax(p);
  let ev: GEvent[] = [];
  hitDome(p, s.domeHp - max * 0.25, 'x', p.base, ev);
  expect(s.domeHp).toBeCloseTo(max * 0.65); expect(ev.some((e) => e.text === 'domeSurge')).toBe(true); expect(s.surged).toBe(true);
  hitDome(p, s.domeHp - max * 0.2, 'x', p.base, []); expect(s.domeHp).toBeCloseTo(max * 0.2);
  // brought to nothing: it holds for three seconds and takes no more, then gives to the next blow
  p.tree = { grace: 1 }; ev = [];
  hitDome(p, 9999, 'x', p.base, ev);
  expect(s.domeHp).toBe(1); expect(ev.some((e) => e.text === 'domeStand')).toBe(true); expect(s.standUntil).toBeCloseTo(p.time + 3 * 3.6);
  hitDome(p, 9999, 'x', p.base, []); expect(s.domeHp).toBe(1);
  p.time = s.standUntil!; hitDome(p, 9999, 'x', p.base, []); expect(s.domeHp).toBe(0);
  // a new wave: each is whole again
  for (const u of raiders(p)) entOf(p, u.id)!.alive = false;
  s.domeHp = domeMax(p); p.siegeQueue = []; s.phase = 'gap'; s.nextAt = p.time;
  p.time += 0.2; siegeTick(p, 0.2, []);
  expect([s.phase, s.surged, s.stood, s.domeHit]).toEqual(['wave', false, false, false]);
});

it('the income nodes: a bigger prize for a cleared wave, bigger again when the dome took no blow; a run of cleared waves adds to what raiders leave until the dome gives; elites leave more', () => {
  const p = idle(), s = p.siege!;
  const clear = (tree: object, hit: boolean) => { p.tree = tree; p.shards = 0; s.wave = 1; s.phase = 'wave'; s.waveAt = p.time; s.domeHit = hit; s.waveGain = 0; const ev: GEvent[] = []; waveCleared(p, WAVE_GAP, ev); return { got: p.shards, note: ev[0]!.text }; };
  expect(clear({}, false)).toEqual({ got: BOUNTY.clear, note: 'waveClear:1' });
  expect(clear({ clearBonus: 2 }, true).got).toBeCloseTo(BOUNTY.clear * 1.8);
  expect(clear({ clearBonus: 2, flawless: 1 }, true).note).toBe('waveClear:1'); expect(p.shards).toBeCloseTo(BOUNTY.clear * 1.8);
  expect(clear({ clearBonus: 2, flawless: 1 }, false).note).toBe('waveClear:1:clean'); expect(p.shards).toBeCloseTo(BOUNTY.clear * 2.7);
  // the run: four waves cleared so far in this test
  expect(s.streak).toBe(4); expect(streakMult(p)).toBe(1);
  p.tree = { streak: 1 }; expect(streakMult(p)).toBeCloseTo(1.08); s.streak = 30; expect(streakMult(p)).toBeCloseTo(1.1);
  // what falls: the run's bonus on all, the elites' own on elites
  p.tree = { streak: 1, eliteBounty: 2 }; p.drops = []; p.shards = 0;
  pour(p, 5);
  const fodder = raiders(p).filter((u) => u.fodder), elite = raiders(p).filter((u) => !u.fodder);
  expect(elite.length).toBeGreaterThan(0);
  for (const u of raiders(p)) entOf(p, u.id)!.alive = false;
  p.time += 0.2; siegeTick(p, 0.2, []);
  const want = (fodder.reduce((a, u) => a + u.bounty!, 0) + elite.reduce((a, u) => a + u.bounty!, 0) * 2) * 1.1;
  expect(p.drops!.reduce((a, d) => a + d.n, 0) + 0).toBeCloseTo(want, 4);
  // the dome gives: the run starts over
  hitDome(p, 1e9, 'x', p.base, []); p.time += 0.2; siegeTick(p, 0.2, []);
  expect(s.phase).toBe('held'); expect(s.streak).toBe(0);
});

it('the next wave can be called early once the tree allows it (its raiders leave a fifth more); a broken dome calls its wave again by itself once the base has learnt to', () => {
  const p = idle(), s = p.siege!;
  rouseSiege(p);
  expect(callWave(p)).toBe(false);
  p.tree = { earlyCall: 1 };
  expect(callWave(p)).toBe(true); expect(s.rush).toBe(1); expect(callWave(p)).toBe(false);
  run(p, 0.2);
  expect(s.wave).toBe(1); expect(s.phase).toBe('wave');
  run(p, 20);
  expect(raiders(p).every((u) => Math.abs(u.bounty! - (u.fodder ? BOUNTY.fodder : BOUNTY.elite) * 1.2) < 1e-9)).toBe(true); expect(raiders(p).length).toBeGreaterThan(0);
  expect(callWave(p)).toBe(false);
  // the dome gives: nothing comes by itself…
  hitDome(p, 1e9, 'x', p.base, []); siegeTick(p, 0.2, []);
  expect(s.phase).toBe('held');
  for (let k = 0; k < 300; k++) { p.time += 0.2; siegeTick(p, 0.2, []); }
  expect(s.phase).toBe('held');
  // …until the base has learnt to: ten seconds after the breach, then sooner with each level
  p.tree = { autoRestart: 1 }; s.heldAt = p.time;
  for (let k = 0; k < 170; k++) { p.time += 0.2; siegeTick(p, 0.2, []); }
  expect(s.phase).toBe('held');
  for (let k = 0; k < 15; k++) { p.time += 0.2; siegeTick(p, 0.2, []); }
  expect(s.phase).not.toBe('held'); expect(domeUp(p)).toBe(true);
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
  // a longer reach: it fires on what stands farther off
  for (const e of [near, next, third]) { e.pos = { x: p.base.x, y: p.base.y - 13 }; e.hp = 100; }
  raiders(p).slice(0, 3).forEach((f, k) => { f.sy = p.base.y - 13 - k * 0.2 + 0.5; });
  p.tree = { gun: 1 }; p.time = s.gunAt!; const at0 = s.gunAt; gunTick(p, []); expect(s.gunAt).toBe(at0);
  p.tree = { gun: 1, gunRange: 2 }; gunTick(p, []); expect(s.gunAt).toBeGreaterThan(at0!); expect(near.hp).toBe(94);
  // three times as hard, when the dice say so
  p.tree = { gun: 1, gunRange: 2, gunCrit: 5 }; p.time = s.gunAt!; p.s.rng.chance = () => true; gunTick(p, []); expect(near.hp).toBe(94 - 18);
  p.s.rng.chance = () => false;
  // a raider nearly dead is finished by any shot
  p.tree = { gun: 1, gunRange: 2, gunExec: 3 }; near.hp = 20; p.time = s.gunAt!; gunTick(p, []); expect(near.alive).toBe(false);
  // the elites first, though the fodder stand nearer
  pour(p, 5); const brute = raiders(p).find((u) => !u.fodder && alive(p, u))!, bre = entOf(p, brute.id)!;
  for (const f of raiders(p)) if (f !== brute && f.sy === undefined) entOf(p, f.id)!.alive = false;
  for (const f of raiders(p)) if (f.fodder && alive(p, f) && f !== raiders(p)[1] && f !== raiders(p)[2]) entOf(p, f.id)!.alive = false;
  bre.hp = bre.maxHp = 500; bre.pos = { x: p.base.x, y: p.base.y - 12 }; next.pos = { x: p.base.x, y: p.base.y - 8 }; raiders(p)[1]!.sy = p.base.y - 8 + 0.5; next.hp = 100;
  p.tree = { gun: 1, gunRange: 2 }; p.time = s.gunAt!; gunTick(p, []); expect(bre.hp).toBe(500); expect(next.hp).toBe(94);
  p.tree = { gun: 1, gunRange: 2, gunElite: 1 }; p.time = s.gunAt!; gunTick(p, []); expect(bre.hp).toBe(494); expect(next.hp).toBe(94);
  p.tree = { gun: 3, gunChain: 2 };
  // out of reach: it holds its fire (and its time)
  for (const e of [near, next, third]) e.pos = { x: p.base.x, y: p.base.y - 17 };
  for (const f of raiders(p).slice(0, 3)) f.sy = p.base.y - 17;
  p.time = s.gunAt!; const at = s.gunAt; gunTick(p, []); expect(s.gunAt).toBe(at);
  expect(bre.hp).toBe(494); expect(next.hp).toBe(94);
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
