import type { DelveParty } from '../delve/delveSim';
import type { GEvent } from '../grid/types';
import type { WorldParty } from '../overworld/worldSim';
import { rejoin, type Carry } from '../roam/carry';
import { startDelve } from './drill';
import { applySf } from './workshop';
import { gatherHome, upgradeOn } from './modules';
import { rouseSiege } from './siege';
import { living } from '../roam/roam';
import { entOf } from '../party/partyCore';

/** The lab's medical bay, switched on: everyone at home is whole again when a clone comes up. */
function healHome(p: WorldParty): void {
  if (!upgradeOn(p, 'medical')) return;
  for (const u of living(p)) { const e = entOf(p, u.id)!; e.hp = e.maxHp; }
}

/** The surface freezes until return. */
export function departSurface(p: WorldParty, seed: number, carry: Carry, floor = 1): DelveParty | null {
  if (p.away || !carry.clones.length) return null;
  const delve = startDelve(p, seed, carry, floor);
  if (delve) p.away = true;
  return delve;
}
/** Return events are queued for the existing worldTick consumer and also returned to callers. */
export function returnToSurface(p: WorldParty, carry: Carry): GEvent[] {
  // the clones that stayed worked the wreck meanwhile (the core's gathering)
  const got = gatherHome(p, living(p).length);
  rejoin(p, carry, p.drill ?? p.base);
  // what they gathered is added to what came up (the carry holds the stores: the base's own waited)
  if (got) { p.ore += got.ore; p.bio += got.bio; }
  for (const k of carry.clones) { const u = p.units.find((x) => x.id === k.unit.id); if (u) applySf(p, u); }
  healHome(p);
  p.away = false; p.trips++; p.deepest = Math.max(p.deepest, carry.deepest ?? 1);
  const ev: GEvent[] = [];
  // (the event carries the ore; the bio-matter is in step with it: GATHER)
  if (got) ev.push({ t: p.time, type: 'buff', text: 'gather', amount: got.ore });
  rouseSiege(p, ev);
  p.baseEvents.push(...ev);
  return ev;
}
/** Up by the return beacon: the clone and its souls come home, but the trip is not over (the floor below is kept). */
export function beaconReturn(p: WorldParty, carry: Carry): GEvent[] {
  rejoin(p, carry, p.drill ?? p.base);
  for (const k of carry.clones) { const u = p.units.find((x) => x.id === k.unit.id); if (u) applySf(p, u); }
  p.away = false; p.deepest = Math.max(p.deepest, carry.deepest ?? 1);
  healHome(p);
  const ev: GEvent[] = [];
  rouseSiege(p, ev);
  p.baseEvents.push(...ev);
  return ev;
}
