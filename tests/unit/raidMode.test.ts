import { expect, it } from 'vitest';
import { newSurface, worldTick, drillClone, canDrill } from '../../src/sim/overworld/worldSim';
import { onRaidReturn, startRaid } from '../../src/sim/base/raids';
import { tick } from '../../src/sim/party/partySim';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { implant, print } from '../../src/sim/roam/roam';

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

it('a raid never stops the clock: nobody is under the hand', () => {
  const p = raid();
  tick(p, 3);
  expect(p.waiting).toBeFalsy(); expect(p.time).toBeCloseTo(3);
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

it('the raid’s end leaves a result for the window: won or lost, the injured, what the kills paid', async () => {
  const { raidResultHtml } = await import('../../src/ui/overworld/raidBar');
  const p = raid(); print(p, undefined, [], p.s.map.start);
  entOf(p, 'hero')!.alive = false;
  for (const f of raiders(p)) entOf(p, f.id)!.alive = false;
  worldTick(p, 0.1);
  expect(p.lastRaid?.won).toBe(true); expect(p.lastRaid?.injured).toEqual(['hero']);
  const html = raidResultHtml(p);
  expect(html).toContain('격퇴'); expect(html).toContain('부상'); expect(html).toContain('처치');
});
