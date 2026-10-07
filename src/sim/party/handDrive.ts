import { dist, type GEvent } from '../grid/types';
import { alive, canHit, entOf, posOf, stats, stepToward, strike, type Party, type Unit } from './partyCore';
import { ULT_REACH, ultSlots } from './ultimate';

/**
 * Raid mode (spec 2026-10-08 §3): the clone the player drives acts on its own moments — a step the way it is pushed,
 * else a blow at the nearest foe in reach. Time never waits for it. Returns whether it acted (it always takes its moment).
 */
export function driveTurn(p: Party, u: Unit, ev: GEvent[]): boolean {
  const d = p.drive;
  if (!d || d.id !== u.id) return false;
  const t = p.time, e = entOf(p, u.id)!, st = stats(u, t, p);
  if (d.dir && stepToward(p, u, { x: e.pos.x + d.dir.x, y: e.pos.y + d.dir.y }, t, ev)) { u.nextAt = t + st.move; return true; }
  const foe = p.units.filter((x) => x.side !== u.side && alive(p, x) && !x.asleep && canHit(p, u, x)).sort((a, b) => dist(posOf(p, a), e.pos) - dist(posOf(p, b), e.pos))[0];
  if (foe) { strike(p, u, foe, t, ev); u.nextAt = t + st.atk; return true; }
  u.nextAt = t + 0.2;
  return true;
}

/** A queued ultimate aimed beyond its reach: the caster walks toward the cell (it stays queued); false once in reach or stuck. */
export function approachUltimate(p: Party, u: Unit, ev: GEvent[]): boolean {
  const s = u.ultCell && ultSlots(u).find((x) => x.slot === (u.ultSlot ?? 0));
  if (!s || !u.ultCell) return false;
  const e = entOf(p, u.id)!;
  if (dist(e.pos, u.ultCell) <= ULT_REACH[s.ult]) return false;
  if (stepToward(p, u, u.ultCell, p.time, ev)) { u.nextAt = p.time + stats(u, p.time, p).move; return true; }
  // no way closer: let it go
  u.ultQueued = false;
  return false;
}
