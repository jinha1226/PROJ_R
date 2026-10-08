import { expect, it } from 'vitest';
import { newSurface, worldTick, drillClone, canDrill } from '../../src/sim/overworld/worldSim';
import { onRaidReturn, startRaid } from '../../src/sim/base/raids';
import { canPlace, place } from '../../src/sim/base/buildings';
import { tick } from '../../src/sim/party/partySim';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { ULT_REACH } from '../../src/sim/party/ultimate';
import { implant, print } from '../../src/sim/roam/roam';
import { dist } from '../../src/sim/grid/types';

/** a surface with the raid on and its raiders parked far off (asleep for the test's purposes) */
const raid = () => {
  const p = newSurface(42); p.ore = 300;
  startRaid(p);
  // only the raiders already out: the rest of the horde never comes
  p.raidQueue = [];
  for (const u of p.units.filter((x) => x.group === p.raid!.group)) { u.nextAt = 999; entOf(p, u.id)!.pos = { x: 1, y: 1 }; if (u.swarm) { u.sx = 1.5; u.sy = 1.5; } }
  return p;
};
const raiders = (p: ReturnType<typeof raid>) => p.units.filter((x) => x.group === p.raid!.group);

it('a raid never stops the clock for the clone under the hand', () => {
  const p = raid(); p.manual = 'hero'; p.drive = { id: 'hero', dir: null };
  tick(p, 3);
  expect(p.waiting).toBeFalsy(); expect(p.time).toBeCloseTo(3);
});

it('a driven clone steps the way it is pushed, and with no push strikes the nearest foe in reach', () => {
  const p = raid(), e = entOf(p, 'hero')!; p.manual = 'hero';
  const from = { ...e.pos }; p.drive = { id: 'hero', dir: { x: 1, y: 0 } };
  tick(p, 1);
  expect(e.pos.x).toBeGreaterThan(from.x);
  p.drive = { id: 'hero', dir: null };
  const f = raiders(p)[0]!, fe = entOf(p, f.id)!; fe.pos = { x: e.pos.x + 1, y: e.pos.y }; fe.hp = fe.maxHp = 500;
  tick(p, 2);
  expect(fe.hp).toBeLessThan(500);
});

it('an ultimate aimed beyond its reach walks the caster closer and fires once in reach', () => {
  const p = raid(), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  u.souls = []; implant(p, u, 'warrior', []);
  const cell = { x: e.pos.x + ULT_REACH.earthSlam + 3, y: e.pos.y };
  for (let k = 0; k < 8 && p.s.map.tiles[cell.y * p.s.map.w + cell.x] !== 'floor'; k++) cell.y++;
  u.ultQueued = true; u.ultSlot = 0; u.ultCell = cell; u.nextAt = p.time;
  tick(p, 0.6);
  expect(u.ultQueued).toBe(true); expect(dist(e.pos, cell)).toBeLessThan(ULT_REACH.earthSlam + 3);
  for (let k = 0; k < 20 && u.ultQueued; k++) tick(p, 1);
  expect(u.ultQueued).toBe(false); expect(u.souls![0]!.ultReady).toBeGreaterThan(0);
});

it('a clone downed in a raid keeps its soul and level, rises at half health when the raid ends, and is injured', () => {
  const p = raid(), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  u.souls = []; implant(p, u, 'rogue', []); u.level = 4;
  const other = print(p, undefined, [], p.s.map.start)!; entOf(p, other.id)!.alive = true;
  e.alive = false; e.hp = 0;
  worldTick(p, 0.1);
  expect(u.souls?.[0]?.cls).toBe('rogue');
  for (const f of raiders(p)) entOf(p, f.id)!.alive = false;
  worldTick(p, 0.1);
  expect(p.raid).toBeNull();
  expect(e.alive).toBe(true); expect(e.hp).toBe(Math.ceil(e.maxHp / 2)); expect(u.level).toBe(4); expect(u.injured).toBe(true);
});

it('with an infirmary standing nobody comes out of a raid injured', () => {
  const p = raid(), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  p.bio = 50;
  let built = false;
  for (let dy = -6; dy <= 6 && !built; dy++) for (let dx = -6; dx <= 6 && !built; dx++) if (canPlace(p, 'infirmary', { x: p.base.x + dx, y: p.base.y + dy })) built = place(p, 'infirmary', { x: p.base.x + dx, y: p.base.y + dy });
  expect(built).toBe(true);
  print(p, undefined, [], p.s.map.start);
  e.alive = false;
  for (const f of raiders(p)) entOf(p, f.id)!.alive = false;
  worldTick(p, 0.1);
  expect(e.alive).toBe(true); expect(u.injured).toBeFalsy();
});

it('an injured clone stays home while a sound one can go, and is well again after the next trip', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!;
  const other = print(p, undefined, [], p.s.map.start)!;
  u.injured = true;
  expect(drillClone(p, 'hero')).toBe(other.id); expect(canDrill(p, 'hero')).toBe(false);
  // with nobody sound at home the injured may still go (no dead end)
  other.injured = true; expect(canDrill(p, 'hero')).toBe(true);
  onRaidReturn(p);
  expect(u.injured).toBeFalsy(); expect(other.injured).toBeFalsy();
});

it('every clone down ends the raid lost, never the run', () => {
  const p = raid();
  for (const u of p.units.filter((x) => x.side === 'hero')) entOf(p, u.id)!.alive = false;
  const ev = worldTick(p, 0.1);
  expect(ev.some((x) => x.text === 'raidLost')).toBe(true); expect(p.raid).toBeNull(); expect(p.over).toBeFalsy();
  expect(entOf(p, 'hero')!.alive).toBe(true);
});

it('the raid’s end leaves a result for the window: won or lost, the injured, the buildings lost', async () => {
  const { raidResultHtml } = await import('../../src/ui/overworld/raidBar');
  const p = raid(); print(p, undefined, [], p.s.map.start);
  entOf(p, 'hero')!.alive = false;
  for (const f of raiders(p)) entOf(p, f.id)!.alive = false;
  worldTick(p, 0.1);
  expect(p.lastRaid?.won).toBe(true); expect(p.lastRaid?.injured).toEqual(['hero']);
  const html = raidResultHtml(p);
  expect(html).toContain('격퇴'); expect(html).toContain('부상'); expect(html).toContain('처치');
});

it('a raid starts with every clone holding its ground: a ranged one never leaves its spot, a melee one steps out to a foe near it and goes back', () => {
  const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  u.souls = []; implant(p, u, 'archer', []);
  const spot = { ...e.pos };
  startRaid(p); p.raidQueue = [];
  expect(u.order).toEqual({ kind: 'hold', cell: spot });
  // a raider far off: the archer stays put
  const f = raiders(p)[0]!, fe = entOf(p, f.id)!;
  fe.pos = { x: spot.x + 9, y: spot.y }; if (f.swarm) { f.sx = fe.pos.x + 0.5; f.sy = fe.pos.y + 0.5; } f.nextAt = 1e9;
  tick(p, 3);
  expect(e.pos).toEqual(spot);
  // a warrior steps out to a foe two cells off its spot, then comes back once it is gone
  const q = newSurface(42), w = unitOf(q, 'hero')!, we = entOf(q, 'hero')!;
  w.souls = []; implant(q, w, 'warrior', []);
  const home = { ...we.pos };
  startRaid(q); q.raidQueue = [];
  const g = raiders(q)[0]!, ge = entOf(q, g.id)!;
  ge.pos = { x: home.x + 2, y: home.y }; ge.hp = ge.maxHp = 9999; if (g.swarm) { g.sx = ge.pos.x + 0.5; g.sy = ge.pos.y + 0.5; } g.nextAt = 1e9;
  for (const o of raiders(q)) if (o !== g) entOf(q, o.id)!.alive = false;
  tick(q, 2);
  expect(dist(we.pos, ge.pos)).toBeLessThanOrEqual(1);
  ge.alive = false; q.raidQueue = [{ at: 999, kind: 'fodder', cell: { x: 1, y: 1 } }];
  tick(q, 4);
  expect(we.pos).toEqual(home);
});
