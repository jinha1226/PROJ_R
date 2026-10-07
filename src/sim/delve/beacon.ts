import { same, type Cell, type GEvent } from '../grid/types';
import { entOf } from '../party/partyCore';
import { living } from '../roam/roam';
import type { DelveParty } from './delveSim';

/** turns the portal takes to open, and turns it stays open */
export const BEACON_TURNS = 5;
export interface Beacon { at: Cell; openAt: number; closeAt: number; shown?: boolean }

/** Out of a fight, once per floor, with a clone standing. */
export const canBeacon = (p: DelveParty): boolean => !p.combat && !p.beaconUsed && !p.beacon && living(p).length > 0;
/** The portal stands open, waiting for the clone to step in. */
export const portalOpen = (p: DelveParty): boolean => !!p.beacon && p.time >= p.beacon.openAt;

/** The portal starts opening where the leading clone stands. */
export function startBeacon(p: DelveParty): GEvent[] {
  if (!canBeacon(p)) return [];
  const lead = entOf(p, p.leader ?? '')?.alive ? p.leader! : living(p)[0]!.id, at = { ...entOf(p, lead)!.pos };
  p.beacon = { at, openAt: p.time + BEACON_TURNS, closeAt: p.time + BEACON_TURNS * 2 };
  return [{ t: p.time, type: 'buff', src: lead, text: 'beacon', to: at }];
}

/**
 * While opening, a fight cuts it (the use stays). Once open it stays open, fight or not, until the clone steps onto it
 * (the floor is kept and left) or its time runs out (the use is spent). Stepping in on the last moment wins over closing.
 */
export function beaconStep(p: DelveParty, ev: GEvent[]): void {
  const b = p.beacon;
  if (!b) return;
  if (p.time < b.openAt) { if (p.combat) { p.beacon = undefined; ev.push({ t: p.time, type: 'buff', text: 'beaconCut' }); } return; }
  if (!b.shown) { b.shown = true; ev.push({ t: p.time, type: 'buff', text: 'beaconOpen', to: b.at }); }
  if (living(p).some((u) => same(entOf(p, u.id)!.pos, b.at))) {
    p.beaconAt = b.at; p.beacon = undefined; p.beaconUsed = true; p.left = true;
    ev.push({ t: p.time, type: 'buff', text: 'beaconEnter', to: b.at });
    return;
  }
  if (p.time >= b.closeAt) { p.beacon = undefined; p.beaconUsed = true; ev.push({ t: p.time, type: 'buff', text: 'beaconClosed', to: b.at }); }
}
