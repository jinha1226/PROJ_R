import { dist, type GEvent } from '../grid/types';
import { entOf, stats, stepToward, type Party, type Unit } from './partyCore';
import { ULT_REACH, ultSlots } from './ultimate';

/** A queued ultimate aimed beyond its reach: the caster walks toward the cell (it stays queued); false once in reach or stuck. */
export function approachUltimate(p: Party, u: Unit, ev: GEvent[]): boolean {
  const s = u.ultCell && ultSlots(u).find((x) => x.slot === (u.ultSlot ?? 0));
  if (!s || !u.ultCell) return false;
  const e = entOf(p, u.id)!;
  if (dist(e.pos, u.ultCell) <= ULT_REACH[s.ult]) return false;
  // a clone held to its post (a raid) never walks to cast: what was aimed out of reach is let go
  if (u.order?.kind === 'hold' && u.order.fixed) { u.ultQueued = false; return false; }
  if (stepToward(p, u, u.ultCell, p.time, ev)) { u.nextAt = p.time + stats(u, p.time, p).move; return true; }
  // no way closer: let it go
  u.ultQueued = false;
  return false;
}
