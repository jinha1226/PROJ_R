import type { Cell, GEvent } from '../grid/types';
import { entOf } from '../party/partyCore';
import { living } from '../roam/roam';
import type { DelveParty } from './delveSim';

/** turns the portal takes to open */
export const BEACON_TURNS = 5;
export interface Beacon { at: Cell; openAt: number }

/** Out of a fight, once per floor, with a clone standing. */
export const canBeacon = (p: DelveParty): boolean => !p.combat && !p.beaconUsed && !p.beacon && living(p).length > 0;

/** The portal starts opening where the leading clone stands. */
export function startBeacon(p: DelveParty): GEvent[] {
  if (!canBeacon(p)) return [];
  const lead = entOf(p, p.leader ?? '')?.alive ? p.leader! : living(p)[0]!.id, at = { ...entOf(p, lead)!.pos };
  p.beacon = { at, openAt: p.time + BEACON_TURNS };
  return [{ t: p.time, type: 'buff', src: lead, text: 'beacon', to: at }];
}

/** A fight cuts the opening (the use stays); once open the floor is kept with its re-entry spot and the use is spent. */
export function beaconStep(p: DelveParty, ev: GEvent[]): void {
  if (!p.beacon) return;
  if (p.combat) { p.beacon = undefined; ev.push({ t: p.time, type: 'buff', text: 'beaconCut' }); return; }
  if (p.time < p.beacon.openAt) return;
  p.beaconAt = p.beacon.at; p.beacon = undefined; p.beaconUsed = true;
  ev.push({ t: p.time, type: 'buff', text: 'beaconOpen', to: p.beaconAt });
}
