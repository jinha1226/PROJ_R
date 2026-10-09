import { expect, it } from 'vitest';
import { newSurface, worldTick, canDrill } from '../../src/sim/overworld/worldSim';
import { canPrintClone } from '../../src/sim/base/cloner';
import { DOME, domeMax, domeUp, FALL_BACK, FIRST_WAVE, FRONT_GUARD, hitDome, planWave, raiders, resumeSiege, RETRY_GAP, REVIVE, rouseSiege, SIEGE_GROUP, SIEGE_MODE, SIEGE_REACH, siegeShown, siegeTick, spawnRaider, WAVE, WAVE_GAP, WAVE_LIMIT, waveOf } from '../../src/sim/base/siege';
import { inDome, rimOf, siegeField } from '../../src/sim/base/siegePath';
import { swarmTick } from '../../src/sim/base/swarm';
import { departSurface, returnToSurface } from '../../src/sim/base/trips';
import { alive, entOf, unitOf } from '../../src/sim/party/partyCore';
import { takeClone, takeParty } from '../../src/sim/roam/carry';
import { clones, implant, living } from '../../src/sim/roam/roam';
import { idx, type GEvent } from '../../src/sim/grid/types';
// (these are about the siege as built: it is switched on for them — by default it is off)
SIEGE_MODE.on = true;

type P = ReturnType<typeof newSurface>;
/** the base with its clones too tough to fall and holding their fire: the horde and the dome by themselves */
const idle = (seed = 42) => { const p = newSurface(seed); for (const u of p.units) if (u.side === 'hero') { u.nextAt = 1e9; const e = entOf(p, u.id)!; e.hp = e.maxHp = 1e6; } return p; };
/** time runs on for the siege alone; `keep`: the dome is topped up every step (the test is not about it giving) */
const run = (p: P, turns: number, step = 0.2, keep = false) => { const ev: GEvent[] = []; for (let t = 0; t < turns; t += step) { p.time += step; if (keep) p.siege!.domeHp = domeMax(p); siegeTick(p, step, ev); } return ev; };
const fodder = (p: P) => p.units.filter((u) => u.swarm && alive(p, u));
/** wave n stepped out whole, at once (the siege counted as in that wave) */
const pour = (p: P, n: number) => { p.siege!.phase = 'wave'; for (const s of planWave(p, n, p.time)) spawnRaider(p, s, []); };

it('the pod lands under its dome: whole, and the land quiet — nothing comes until a clone has been down and back', () => {
  const p = newSurface(42), s = p.siege!;
  expect(s).toMatchObject({ wave: 0, best: 0, domeHp: DOME.hp, downUntil: 0, auto: false, phase: 'quiet' });
  expect(domeUp(p)).toBe(true); expect(raiders(p)).toHaveLength(0);
  for (let k = 0; k < 600; k++) worldTick(p, 0.2);
  expect(s.phase).toBe('quiet'); expect(s.wave).toBe(0); expect(raiders(p)).toHaveLength(0);
  // down the shaft and back: the drill was heard, the first wave is counted down
  const d = departSurface(p, 5, takeClone(p, 'hero'))!;
  const back = returnToSurface(p, takeParty(d));
  expect(back.some((e) => e.text === 'siegeStart')).toBe(true); expect(s.phase).toBe('gap'); expect(s.nextAt).toBe(p.time + FIRST_WAVE);
  // (once only: a second return calls nothing more)
  expect(returnToSurface(p, takeParty(departSurface(p, 6, takeClone(p, 'hero'))!)).some((e) => e.text === 'siegeStart')).toBe(false);
  // everything of ours stands under it: the pod, the three modules, the cells the clones come up on
  for (const m of p.modules!) expect(inDome(p, m.at)).toBe(true);
  expect(inDome(p, p.base)).toBe(true); expect(inDome(p, p.s.map.start)).toBe(true);
  expect(inDome(p, { x: p.base.x, y: p.base.y - 8 })).toBe(false);
  // the old surface has no siege
});

it('waves grow without end: more bodies, tougher and harder-hitting; ogres every fifth and alone between, archers from the third, the general every twentieth — elites take the place of fodder', () => {
  expect(waveOf(1)).toMatchObject({ fodder: 14, hp: 1, dmg: WAVE.dmg0, brutes: 0, archers: 0, general: false });
  expect(waveOf(3).archers).toBe(1); expect(waveOf(5)).toMatchObject({ fodder: 18, brutes: 1 }); expect(waveOf(7)).toMatchObject({ fodder: 17, brutes: 1 }); expect(waveOf(6).fodder).toBe(21);
  expect(waveOf(10).hp).toBeCloseTo(WAVE.hp ** 9); expect(waveOf(10).brutes).toBe(1); expect(waveOf(15).brutes).toBe(2); expect(waveOf(13).archers).toBe(2);
  expect(waveOf(20).general).toBe(true); expect(waveOf(26).fodder).toBe(WAVE.bodiesMax); expect(waveOf(60).hp).toBeGreaterThan(waveOf(30).hp * 5);
  // a wave is never all elites
  expect(waveOf(100).fodder).toBeGreaterThanOrEqual(WAVE.bodiesMax * WAVE.boss * 0.3 - 1);
  const p = newSurface(42), plan = planWave(p, 20, 100);
  expect(plan.filter((s) => s.kind === 'fodder')).toHaveLength(26); expect(plan.filter((s) => s.kind === 'brute')).toHaveLength(2); expect(plan[plan.length - 1]!.kind).toBe('general');
  // out of the north, on a wide front
  expect(plan.every((s) => s.cell.y === p.base.y - SIEGE_REACH)).toBe(true); expect(new Set(plan.map((s) => s.cell.x)).size).toBeGreaterThan(10);
});

it('a wave steps out when its count runs down; the next only once it is cleared, after a breath; the highest reached is kept', () => {
  const p = idle(), s = p.siege!;
  rouseSiege(p);
  run(p, FIRST_WAVE - 1, 0.2, true);
  expect(s.wave).toBe(0); expect(raiders(p)).toHaveLength(0);
  const ev = run(p, 2, 0.2, true);
  expect(s.wave).toBe(1); expect(s.phase).toBe('wave'); expect(ev.some((e) => e.text === 'wave' && e.amount === 1)).toBe(true);
  // nobody fights it: it stands at the dome and no second wave comes
  run(p, 120, 0.2, true);
  expect(s.wave).toBe(1); expect(raiders(p).length).toBe(waveOf(1).fodder);
  // (a wave that never ends has lost its way: after a long while what is left slinks off and the siege goes on)
  const q = idle(), qs = q.siege!; rouseSiege(q); run(q, FIRST_WAVE + WAVE_LIMIT + 4, 0.4, true);
  expect(qs.phase).toBe('gap'); expect(qs.wave).toBe(1); expect(raiders(q).filter((u) => alive(q, u))).toHaveLength(0); expect(qs.kills).toBe(0);
  for (const u of raiders(p)) entOf(p, u.id)!.alive = false;
  run(p, 0.4, 0.2, true);
  expect(s.phase).toBe('gap'); expect(s.nextAt).toBeCloseTo(p.time - 0.2 + WAVE_GAP, 5);
  run(p, WAVE_GAP - 2, 0.2, true); expect(s.wave).toBe(1);
  run(p, 3, 0.2, true); expect(s.wave).toBe(2); expect(s.best).toBe(2);
  // raiders are of the siege's own group, awake, and none of them teaches or feeds anyone
  for (const u of raiders(p)) { expect(u.group).toBe(SIEGE_GROUP); expect(u.lean).toBe(true); expect(u.asleep).toBe(false); }
});

it('nothing gets in while the dome stands: the horde walks to its rim and hacks at it there', () => {
  const p = idle(), s = p.siege!;
  pour(p, 6);
  const n = fodder(p).length;
  s.nextAt = 1e9;
  let low = DOME.hp;
  for (let k = 0; k < 40; k++) {
    run(p, 2, 0.2, true);
    low = Math.min(low, s.domeHp);
    for (const f of fodder(p)) expect(inDome(p, entOf(p, f.id)!.pos)).toBe(false);
  }
  // most of it has reached the rim, none stood frozen out in the field
  const field = siegeField(p), rim = rimOf(p);
  expect(fodder(p).filter((f) => field[idx(p.s.map, entOf(p, f.id)!.pos)]! > 3)).toHaveLength(0);
  expect(fodder(p).some((f) => rim.has(idx(p.s.map, entOf(p, f.id)!.pos)))).toBe(true);
  expect(n).toBeGreaterThan(10); expect(low).toBeLessThan(DOME.hp);
});

it('a clone under the dome is not struck; one out before it is', () => {
  const p = idle(), e = entOf(p, 'hero')!;
  for (const u of p.units) if (u.side === 'hero') entOf(p, u.id)!.hp = entOf(p, u.id)!.maxHp = 1000;
  expect(inDome(p, e.pos)).toBe(true);
  pour(p, 10);
  for (let k = 0; k < 300; k++) { p.time += 0.2; swarmTick(p, 0.2, []); }
  expect(e.hp).toBe(1000);
  e.pos = { x: p.base.x, y: p.base.y - 6 };
  for (let k = 0; k < 60; k++) { p.time += 0.2; swarmTick(p, 0.2, []); }
  expect(e.hp).toBeLessThan(1000);
});

it('the dome mends by itself; when it gives, the whole horde is thrown back and the siege stops at that wave until the player calls it — nothing of ours is lost', () => {
  const p = idle(), s = p.siege!;
  p.ore = 77;
  hitDome(p, 50, 'x', p.base, []);
  expect(s.domeHp).toBe(DOME.hp - 50);
  run(p, 10); expect(s.domeHp).toBeGreaterThan(DOME.hp - 50);
  s.wave = 20; s.best = 20; s.nextAt = p.time + 1e6;
  pour(p, 20);
  hitDome(p, 1e6, 'x', p.base, []);
  const ev = run(p, 0.2);
  expect(ev.some((e) => e.text === 'domeBreak')).toBe(true);
  expect(domeUp(p)).toBe(false); expect(raiders(p)).toHaveLength(0); expect(p.s.foes.some((e) => e.group === SIEGE_GROUP)).toBe(false);
  expect(s.phase).toBe('held'); expect(s.wave).toBe(19); expect(s.best).toBe(20);
  // down: no wave comes, no blow lands
  hitDome(p, 10, 'x', p.base, []); run(p, DOME.lull - 2);
  expect(domeUp(p)).toBe(false); expect(raiders(p)).toHaveLength(0);
  const up = run(p, 3);
  expect(up.some((e) => e.text === 'domeUp')).toBe(true); expect(domeUp(p)).toBe(true); expect(s.domeHp).toBe(domeMax(p));
  // whole again, and still nothing comes: the wave waits for the word
  run(p, 200); expect(s.phase).toBe('held'); expect(s.wave).toBe(19); expect(raiders(p)).toHaveLength(0);
  expect(resumeSiege(p)).toBe(true); expect(s.phase).toBe('gap'); expect(resumeSiege(p)).toBe(false);
  run(p, RETRY_GAP + 0.4, 0.2, true); expect(s.wave).toBe(20); expect(s.phase).toBe('wave'); expect(raiders(p).length).toBeGreaterThan(0);
  // the word given while the dome is still down relights it at once
  hitDome(p, 1e6, 'x', p.base, []); run(p, 0.2);
  expect(domeUp(p)).toBe(false); expect(resumeSiege(p)).toBe(true); expect(domeUp(p)).toBe(true); expect(s.domeHp).toBe(domeMax(p)); expect(s.wave).toBe(19);
  expect(p.ore).toBe(77); expect(p.modules!.filter((m) => m.id !== 'workshop').every((m) => !m.broken)).toBe(true); expect(living(p)).toHaveLength(1);
});

it('a ranged clone keeps a place just inside the dome\'s north rim; a melee one just before it, going for what comes near', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  for (let k = 0; k < 200; k++) worldTick(p, 0.2);
  // the empty body shoots: inside, by the north rim
  expect(u.station?.mode).toBe('rim'); expect(inDome(p, e.pos)).toBe(true); expect(e.pos.y).toBeLessThan(p.base.y);
  expect(u.order).toMatchObject({ kind: 'hold', guard: 0 });
  const q = newSurface(42), w = unitOf(q, 'hero')!, we = entOf(q, 'hero')!;
  w.souls = []; implant(q, w, 'warrior', []);
  q.siege!.nextAt = 1e9;
  for (let k = 0; k < 200; k++) worldTick(q, 0.2);
  expect(w.station?.mode).toBe('front'); expect(inDome(q, we.pos)).toBe(false); expect(we.pos.y).toBeLessThan(q.base.y);
  expect(w.order).toMatchObject({ kind: 'hold', guard: FRONT_GUARD });
});

it('a clone hurt badly falls back under the dome and mends there; one that falls rises by the pod after a while, soul and level kept', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  u.souls = []; implant(p, u, 'warrior', []); u.level = 4;
  p.siege!.nextAt = 1e9;
  for (let k = 0; k < 150; k++) worldTick(p, 0.2);
  expect(inDome(p, e.pos)).toBe(false);
  e.hp = Math.floor(e.maxHp * FALL_BACK) - 1;
  for (let k = 0; k < 100; k++) worldTick(p, 0.2);
  expect(u.fallBack).toBe(true); expect(inDome(p, e.pos)).toBe(true); expect(e.hp).toBeGreaterThan(e.maxHp * FALL_BACK);
  for (let k = 0; k < 400; k++) worldTick(p, 0.2);
  expect(u.fallBack).toBe(false); expect(inDome(p, e.pos)).toBe(false);
  // it falls: nothing is over, and it is back after a while at half health
  e.alive = false; e.hp = 0;
  const ev: GEvent[] = [];
  for (let k = 0; k < (REVIVE - 2) / 0.2; k++) ev.push(...worldTick(p, 0.2));
  expect(e.alive).toBe(false); expect(p.over).toBeFalsy(); expect(ev.some((x) => x.type === 'dead')).toBe(false);
  for (let k = 0; k < 20; k++) ev.push(...worldTick(p, 0.2));
  expect(e.alive).toBe(true); expect(e.hp).toBeGreaterThanOrEqual(Math.ceil(e.maxHp / 2)); expect(inDome(p, e.pos)).toBe(true);
  expect(u.souls?.[0]?.cls).toBe('warrior'); expect(u.level).toBe(4); expect(ev.some((x) => x.text === 'revive')).toBe(true);
});

it('the siege feeds nobody: no experience, no ore from its dead; they are counted and cleared away', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, s = p.siege!;
  u.wentDown = true; s.nextAt = 1e9;
  pour(p, 5);
  const [xp, ore] = [u.xp ?? 0, p.ore], n = raiders(p).length;
  for (const f of raiders(p)) entOf(p, f.id)!.alive = false;
  worldTick(p, 0.2);
  expect([u.xp ?? 0, p.ore]).toEqual([xp, ore]); expect(s.kills).toBe(n); expect(raiders(p)).toHaveLength(n);
  for (let k = 0; k < 60; k++) worldTick(p, 0.2);
  expect(raiders(p)).toHaveLength(0); expect(p.s.foes.some((e) => e.group === SIEGE_GROUP)).toBe(false);
});

it('Auto hands the clones their own ultimates; off, they wait for the player', () => {
  const p = newSurface(42);
  worldTick(p, 0.2); expect(p.manualUlts).toBe(true);
  p.siege!.auto = true; worldTick(p, 0.2); expect(p.manualUlts).toBe(false);
});

it('the fight never ends at the base, so a clone goes down and a body is printed in the middle of it; the surface waits while one is below', () => {
  const p = newSurface(42);
  for (let k = 0; k < 400; k++) worldTick(p, 0.2);
  expect(p.combat).toBe(true); expect(canDrill(p, 'hero')).toBe(true);
  expect(canPrintClone(p)).toBe(true);
  const wave = p.siege!.wave, t = p.time;
  const d = departSurface(p, 5, takeClone(p, 'hero'))!;
  expect(worldTick(p, 50)).toEqual([]); expect(p.time).toBe(t); expect(p.siege!.wave).toBe(wave);
  returnToSurface(p, takeParty(d));
  expect(p.away).toBe(false); expect(p.trips).toBe(1); expect(living(p)).toHaveLength(1);
});

it('with no clone left at all (the last fell below), the base prints a new body as before', () => {
  const p = newSurface(42);
  const d = departSurface(p, 5, takeClone(p, 'hero'))!; d.s.hero.alive = false;
  returnToSurface(p, takeParty(d));
  expect(clones(p)).toHaveLength(0);
  for (let k = 0; k < 40; k++) worldTick(p, 0.2);
  expect(living(p)).toHaveLength(1); expect(p.over).toBeFalsy();
});

it('a tick of a siege deep into its waves stays cheap', () => {
  const p = idle(); p.siege!.nextAt = 1e9;
  // (a dome strong enough to stand under five deep waves at once: the test is about the horde's cost, not the dome)
  p.tree = { domeHp: 60 };
  for (const n of [40, 41, 42, 43, 44]) pour(p, n);
  run(p, 30, 0.25, true);
  expect(fodder(p).length).toBeGreaterThan(150);
  const t0 = performance.now(); for (let k = 0; k < 30; k++) { p.time += 0.1; swarmTick(p, 0.1, []); }
  expect((performance.now() - t0) / 30).toBeLessThan(8);
}, 30_000);

it('switched off, a return from below rouses nothing and the base shows none of the siege', () => {
  SIEGE_MODE.on = false;
  try {
    const p = newSurface(42);
    expect(siegeShown(p)).toBe(false);
    const back = returnToSurface(p, takeParty(departSurface(p, 5, takeClone(p, 'hero'))!));
    expect(back.some((e) => e.text === 'siegeStart')).toBe(false); expect(p.siege!.phase).toBe('quiet');
    // one already under way (the address bar's switch, the demo) is shown all the same
    p.siege!.phase = 'gap'; expect(siegeShown(p)).toBe(true);
  } finally { SIEGE_MODE.on = true; }
});
