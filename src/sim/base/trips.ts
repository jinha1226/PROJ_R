import type { DelveParty } from '../delve/delveSim';
import type { GEvent } from '../grid/types';
import type { WorldParty } from '../overworld/worldSim';
import { rejoin, type Carry } from '../roam/carry';
import { startDelve } from './drill';
import { onRaidReturn } from './raids';
import { onReturn } from './buildings';
import { applySf } from './workshop';

/** The surface freezes until return; a live raid must be resolved before departure. */
export function departSurface(p: WorldParty, seed: number, carry: Carry, floor = 1): DelveParty | null {
  // a raid under way or one waiting to be started keeps the party home
  if (p.away || p.raid || p.raidReady || !carry.clones.length) return null;
  const delve = startDelve(p, seed, carry, floor);
  if (delve) p.away = true;
  return delve;
}
/** Return events are queued for the existing worldTick consumer and also returned to callers. */
export function returnToSurface(p: WorldParty, carry: Carry): GEvent[] {
  rejoin(p, carry, p.drill ?? p.base);
  for (const k of carry.clones) { const u = p.units.find((x) => x.id === k.unit.id); if (u) applySf(p, u); }
  const ev = onRaidReturn(p, carry.deepest ?? 1);
  p.baseEvents.push(...ev);
  return ev;
}
/** Up by the return beacon: the clone and its souls come home, but the trip is not over (the raid schedule waits). */
export function beaconReturn(p: WorldParty, carry: Carry): GEvent[] {
  rejoin(p, carry, p.drill ?? p.base);
  for (const k of carry.clones) { const u = p.units.find((x) => x.id === k.unit.id); if (u) applySf(p, u); }
  p.away = false; p.deepest = Math.max(p.deepest, carry.deepest ?? 1);
  onReturn(p);
  return [];
}
