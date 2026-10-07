import { expect, it } from 'vitest';
import { newDelve, delveTick, descend, reenter } from '../../src/sim/delve/delveSim';
import { BEACON_TURNS, canBeacon, startBeacon } from '../../src/sim/delve/beacon';
import { takeParty } from '../../src/sim/roam/carry';
import { entOf } from '../../src/sim/party/partyCore';
import { living } from '../../src/sim/roam/roam';
import type { GEvent } from '../../src/sim/grid/types';

const calm = () => { const p = newDelve(11, 1); for (const u of p.units) if (u.side === 'foe') { u.asleep = true; entOf(p, u.id)!.alive = false; } return p; };
const run = (p: ReturnType<typeof newDelve>, secs: number) => { const ev: GEvent[] = []; for (let i = 0; i < secs * 10; i++) ev.push(...delveTick(p, 0.1)); return ev; };

it('the portal takes five turns, then opens once', () => {
  const p = calm();
  expect(startBeacon(p).length).toBeGreaterThan(0);
  expect(run(p, BEACON_TURNS - 0.5).some((e) => e.text === 'beaconOpen')).toBe(false);
  expect(run(p, 1).filter((e) => e.text === 'beaconOpen')).toHaveLength(1);
  expect(p.beaconAt).toEqual(entOf(p, 'hero')!.pos);
  expect(canBeacon(p)).toBe(false);
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
  startBeacon(p); run(p, BEACON_TURNS + 1);
  expect(canBeacon(p)).toBe(false);
  entOf(p, 'hero')!.pos = { ...p.s.map.stairs! };
  expect(descend(p)).toBe(true);
  expect(canBeacon(p)).toBe(true);
});

it('the kept floor takes a clone back at the beacon spot', () => {
  const p = calm();
  startBeacon(p); run(p, BEACON_TURNS + 1);
  const spot = { ...p.beaconAt! }, c = takeParty(p);
  p.units = p.units.filter((u) => u.side !== 'hero'); entOf(p, 'hero')!.alive = false;
  reenter(p, c);
  expect(living(p)).toHaveLength(1);
  expect(entOf(p, living(p)[0]!.id)!.pos).toEqual(spot);
});
