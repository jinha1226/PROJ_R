import { expect, it } from 'vitest';
import { newDelve, delveTick, descend, reenter } from '../../src/sim/delve/delveSim';
import { BEACON_TURNS, beaconStep, canBeacon, canEnterPortal, enterPortal, portalOpen, startBeacon } from '../../src/sim/delve/beacon';
import { takeParty } from '../../src/sim/roam/carry';
import { entOf } from '../../src/sim/party/partyCore';
import { living } from '../../src/sim/roam/roam';
import type { GEvent } from '../../src/sim/grid/types';

const calm = () => { const p = newDelve(11, 1); for (const u of p.units) if (u.side === 'foe') { u.asleep = true; entOf(p, u.id)!.alive = false; } return p; };
const run = (p: ReturnType<typeof newDelve>, secs: number) => { const ev: GEvent[] = []; for (let i = 0; i < secs * 10; i++) ev.push(...delveTick(p, 0.1)); return ev; };

it('the portal opens five turns after use where it was used; standing on it is not enough, the clone goes in with 들어가기', () => {
  const p = calm(), at = { ...entOf(p, 'hero')!.pos };
  startBeacon(p);
  entOf(p, 'hero')!.pos = { x: at.x + 1, y: at.y };
  const ev = run(p, BEACON_TURNS + 0.5);
  expect(ev.filter((e) => e.text === 'beaconOpen')).toHaveLength(1);
  expect(portalOpen(p)).toBe(true); expect(canEnterPortal(p)).toBe(false); expect(enterPortal(p)).toEqual([]);
  entOf(p, 'hero')!.pos = { ...at };
  expect(run(p, 0.5).some((e) => e.text === 'beaconEnter')).toBe(false);
  expect(p.left).toBeFalsy(); expect(canEnterPortal(p)).toBe(true);
  expect(enterPortal(p).map((e) => e.text)).toEqual(['beaconEnter']);
  expect(p.left).toBe(true); expect(p.beaconAt).toEqual(at); expect(canBeacon(p)).toBe(false);
});

it('not gone into in time, the portal closes and the floor use is spent', () => {
  const p = calm(), at = { ...entOf(p, 'hero')!.pos };
  startBeacon(p);
  entOf(p, 'hero')!.pos = { x: at.x + 2, y: at.y };
  const ev = run(p, BEACON_TURNS * 2 + 0.5);
  expect(ev.filter((e) => e.text === 'beaconClosed')).toHaveLength(1);
  expect(ev.some((e) => e.text === 'beaconEnter')).toBe(false);
  expect(portalOpen(p)).toBe(false); expect(canBeacon(p)).toBe(false); expect(p.left).toBeFalsy();
});

it('once open, a fight does not close it', () => {
  const p = calm(), at = { ...entOf(p, 'hero')!.pos };
  startBeacon(p);
  entOf(p, 'hero')!.pos = { x: at.x + 1, y: at.y };
  run(p, BEACON_TURNS + 0.5);
  p.combat = true; beaconStep(p, []);
  expect(portalOpen(p)).toBe(true);
});

it('once it has closed, 들어가기 does nothing', () => {
  const p = calm(), at = { ...entOf(p, 'hero')!.pos };
  startBeacon(p);
  run(p, BEACON_TURNS * 2 + 0.5);
  entOf(p, 'hero')!.pos = { ...at };
  expect(portalOpen(p)).toBe(false); expect(enterPortal(p)).toEqual([]); expect(p.left).toBeFalsy();
});

it('no beacon in a fight; a fight while it opens cancels it and the use stays', () => {
  const p = calm();
  p.combat = true;
  expect(startBeacon(p)).toEqual([]);
  p.combat = false;
  startBeacon(p);
  const foe = p.units.find((u) => u.side === 'foe')!, fe = entOf(p, foe.id)!, me = entOf(p, 'hero')!;
  fe.alive = true; fe.pos = { x: me.pos.x + 2, y: me.pos.y }; foe.asleep = false;
  const ev = run(p, 0.3);
  expect(ev.some((e) => e.text === 'beaconCut')).toBe(true);
  expect(p.beacon).toBeUndefined();
  fe.alive = false; foe.asleep = true; p.combat = false;
  expect(canBeacon(p)).toBe(true);
});

it('once per floor; a new floor charges it again', () => {
  const p = calm();
  startBeacon(p); run(p, BEACON_TURNS + 1); enterPortal(p);
  expect(p.left).toBe(true); expect(canBeacon(p)).toBe(false);
  // back down on the kept floor (as reenter does), the clone takes the stairs
  p.left = false;
  entOf(p, 'hero')!.pos = { ...p.s.map.stairs! };
  expect(descend(p)).toBe(true);
  expect(canBeacon(p)).toBe(true);
});

it('the kept floor takes a clone back at the beacon spot', () => {
  const p = calm();
  startBeacon(p); run(p, BEACON_TURNS + 1); enterPortal(p);
  const spot = { ...p.beaconAt! }, c = takeParty(p);
  p.units = p.units.filter((u) => u.side !== 'hero'); entOf(p, 'hero')!.alive = false;
  reenter(p, c);
  expect(living(p)).toHaveLength(1);
  expect(entOf(p, living(p)[0]!.id)!.pos).toEqual(spot);
});
