import { expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { homeLife } from '../../src/sim/base/baseLife';
import { setPost } from '../../src/sim/base/posts';
import { startRaid } from '../../src/sim/base/raids';
import { tick } from '../../src/sim/party/partySim';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { queueUltimate, ULT_REACH } from '../../src/sim/party/ultimate';
import { implant, print } from '../../src/sim/roam/roam';
import { dist } from '../../src/sim/grid/types';

const raiders = (p: ReturnType<typeof newSurface>) => p.units.filter((x) => x.group === p.raid!.group);
/** the raid on, with only one raider left out there, parked and tough */
const raidWithOne = (p: ReturnType<typeof newSurface>, at: { x: number; y: number }) => {
  startRaid(p); p.raidQueue = [];
  const [f, ...rest] = raiders(p);
  for (const o of rest) entOf(p, o.id)!.alive = false;
  const fe = entOf(p, f!.id)!; fe.pos = { ...at }; fe.hp = fe.maxHp = 9999; f!.nextAt = 1e9; f!.swarm = false; fe.swarm = false;
  return { f: f!, fe };
};

it('a clone given a post walks there by day and stands; the same cell again takes the post away', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  const post = { x: e.pos.x + 3, y: e.pos.y + 1 };
  expect(setPost(p, 'hero', post)).toBe(true);
  for (let k = 0; k < 80; k++) { homeLife(p, p.time); worldTick(p, 0.2); }
  expect(e.pos).toEqual(post);
  // it stays: no stroll takes it off
  for (let k = 0; k < 60; k++) { homeLife(p, p.time); worldTick(p, 0.2); }
  expect(e.pos).toEqual(post);
  expect(setPost(p, 'hero', post)).toBe(true); expect(u.post).toBeUndefined();
  // on a raid night too (that is when most posts are given), and with strolling told off
  p.raidReady = { size: 40, sides: [0] };
  const far = { x: post.x - 5, y: post.y };
  setPost(p, 'hero', far);
  for (let k = 0; k < 80; k++) { homeLife(p, p.time, false); worldTick(p, 0.2); }
  expect(e.pos).toEqual(far);
});

it('two clones never share a post, and a post is set only on our own open ground', () => {
  const p = newSurface(42), other = print(p, undefined, [], p.s.map.start)!;
  const at = { x: p.base.x - 4, y: p.base.y + 4 };
  expect(setPost(p, 'hero', at)).toBe(true);
  expect(setPost(p, other.id, at)).toBe(false);
  expect(setPost(p, other.id, { x: 2, y: 2 })).toBe(false);
  expect(setPost(p, other.id, p.base)).toBe(false);
});

it('when the raid starts every clone is on its post and holds it for the whole raid; its ultimates wait for the player', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  const post = { x: p.base.x - 5, y: p.base.y - 5 };
  setPost(p, 'hero', post);
  const ev = startRaid(p);
  expect(e.pos).toEqual(post); expect(ev.some((x) => x.type === 'move' && x.src === 'hero')).toBe(true);
  expect(u.order).toEqual({ kind: 'hold', cell: post, fixed: true });
  expect(p.manualUlts).toBe(true);
  // a clone with no post holds where it stood
  const q = newSurface(42), at = { ...entOf(q, 'hero')!.pos };
  startRaid(q);
  expect(unitOf(q, 'hero')!.order).toEqual({ kind: 'hold', cell: at, fixed: true });
});

it('a posted warrior never steps out to a foe near it, and the lulls between waves do not release it', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  u.souls = []; implant(p, u, 'warrior', []);
  const home = { ...e.pos };
  raidWithOne(p, { x: home.x + 2, y: home.y });
  for (let k = 0; k < 30; k++) worldTick(p, 0.2);
  expect(e.pos).toEqual(home); expect(p.combat).toBe(true); expect(u.order).toMatchObject({ kind: 'hold', fixed: true });
});

it('no clone reaches for its own ultimate in a raid; one the player aims goes off', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  const { fe } = raidWithOne(p, { x: e.pos.x + 3, y: e.pos.y });
  for (let k = 0; k < 40; k++) tick(p, 0.25);
  expect(u.ultReady).toBe(0);
  queueUltimate(p, 'hero', fe.pos, 0); u.nextAt = p.time;
  for (let k = 0; k < 8; k++) tick(p, 0.25);
  expect(u.ultReady).toBeGreaterThan(0);
});

it('an ultimate aimed out of reach is let go: the posted clone does not walk to cast it', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  u.souls = []; implant(p, u, 'warrior', []);
  const home = { ...e.pos };
  raidWithOne(p, { x: 2, y: 2 });
  u.ultQueued = true; u.ultSlot = 0; u.ultCell = { x: home.x + ULT_REACH.earthSlam + 3, y: home.y }; u.nextAt = p.time;
  tick(p, 1);
  expect(e.pos).toEqual(home); expect(u.ultQueued).toBe(false);
});

it('a warrior that leaps out with its ultimate is back on its post at its next moment', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  u.souls = []; implant(p, u, 'warrior', []);
  const home = { ...e.pos };
  const { fe } = raidWithOne(p, { x: home.x + 4, y: home.y });
  const land = { x: home.x + 3, y: home.y };
  queueUltimate(p, 'hero', land, 0); u.nextAt = p.time;
  let out = false;
  for (let k = 0; k < 40; k++) { tick(p, 0.05); out ||= dist(e.pos, home) > 0; }
  expect(out).toBe(true); expect(e.pos).toEqual(home); expect(fe.hp).toBeLessThan(9999);
});
