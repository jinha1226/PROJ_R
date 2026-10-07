import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { newDelve, delveTick, canAscend, canDescend } from '../../src/sim/delve/delveSim';
import { BEACON_TURNS, enterPortal, startBeacon } from '../../src/sim/delve/beacon';
import { blank, canTakeSoul, implant, implantCarried, print } from '../../src/sim/roam/roam';
import { spawnFoe } from '../../src/sim/grid/foes';
import { takeClone } from '../../src/sim/roam/carry';
import { awardXp } from '../../src/sim/party/partyLevel';
import { entOf, unitOf, type Unit } from '../../src/sim/party/partyCore';
import type { GEvent } from '../../src/sim/grid/types';

it('a fresh body waiting at the base gains no experience from fights nearby, so it can still take a soul', () => {
  const p = newSurface(6), u = unitOf(p, 'hero')!;
  // a raider falls right beside it
  const fe = spawnFoe(p.s, 'brute', { ...entOf(p, 'hero')!.pos }, true), foe: Unit = { ...blank(), id: fe.id, side: 'foe', foe: 'brute' };
  p.units.push(foe); fe.alive = false;
  awardXp(p, foe, []);
  expect(u.level ?? 1).toBe(1);
  expect(canTakeSoul(p, u)).toBe(true);
});

it('a named hero soul first still leaves the second slot open', () => {
  const p = newSurface(6), u = unitOf(p, 'hero')!;
  implant(p, u, { cls: 'warrior', hero: 'aren' }, []);
  p.carried = ['mage'];
  expect(implantCarried(p, 'hero', 0).length).toBeGreaterThan(0);
});

it('a hero held at the base is not rolled again below', () => {
  const p = newSurface(6), b = print(p, undefined, [], p.drill!)!;
  implant(p, unitOf(p, 'hero')!, { cls: 'warrior', hero: 'aren' }, []);
  p.carried = [{ cls: 'cleric', hero: 'seraphine' }];
  const c = takeClone(p, b.id);
  expect(c.foundHeroes).toEqual(expect.arrayContaining(['aren', 'seraphine']));
});

it('once the clone goes into the portal the floor stops: no lift, no stairs, no more time', () => {
  const p = newDelve(11, 1);
  for (const u of p.units) if (u.side === 'foe') { entOf(p, u.id)!.alive = false; u.reaped = true; }
  startBeacon(p);
  const ev: GEvent[] = [];
  for (let i = 0; i < (BEACON_TURNS + 1) * 10; i++) ev.push(...delveTick(p, 0.1));
  expect(ev.some((e) => e.text === 'beaconOpen')).toBe(true);
  enterPortal(p);
  entOf(p, 'hero')!.pos = { ...p.base };
  expect(canAscend(p)).toBe(false); expect(canDescend(p)).toBe(false);
  const t = p.time;
  expect(delveTick(p, 1)).toEqual([]); expect(p.time).toBe(t);
});
