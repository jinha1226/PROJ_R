import { dist, idx, same, type GEvent } from '../grid/types';
import { alive, canHit, entOf, posOf, stats, stepToward, strike, type Party, type Unit } from './partyCore';

/**
 * `?demo=swarm` (2026-10-10, the dungeon-crawl-meets-survivors idea): the clone the player leads only walks; its blows are
 * its own business. The basic attack runs on its own clock — whenever it is ready and a foe in sight is in reach, it lands,
 * walking or standing — and the clone never steps anywhere by itself. Off everywhere else.
 */
export const AUTOHIT = { on: false };

/** a blow this close to ready goes with the step being taken (so a walk at about the weapon's pace still swings every step) */
const SLACK = 0.2;

/** The led clone's moment while blows are automatic: the blow if it is due, then a step of the walk it was told, else it stands. */
export function autoHitTurn(p: Party, u: Unit, t: number, ev: GEvent[]): number {
  const e = entOf(p, u.id)!, st = stats(u, t, p);
  // nothing but a walk is ever asked of it
  if (u.order && u.order.kind !== 'move') u.order = null;
  if (t + SLACK >= (u.swingAt ?? 0)) {
    const foe = p.units.filter((f) => f.side === 'foe' && alive(p, f) && p.s.visible.has(idx(p.s.map, posOf(p, f))) && canHit(p, u, f))
      .sort((a, b) => dist(posOf(p, a), e.pos) - dist(posOf(p, b), e.pos))[0];
    if (foe) { strike(p, u, foe, t, ev); u.swingAt = t + st.atk; if (!alive(p, u)) return st.atk; }
  }
  if (u.order?.kind === 'move') {
    const cell = u.order.cell;
    if (!same(e.pos, cell) && stepToward(p, u, cell, t, ev)) { if (same(e.pos, cell)) u.order = null; return st.move; }
    u.order = null;
  }
  // standing: the next moment is the next blow (one moment a blow, as a fight always ran)
  const wait = (u.swingAt ?? 0) - t;
  return wait > SLACK ? wait - SLACK + 0.01 : Math.min(st.atk, st.move);
}

/**
 * The floor closes in: the sleeping band nearest the clones wakes and comes for them from wherever it is (it does not doze
 * off again on the way). False when every band is already up.
 */
export function rouseBand(p: Party, t: number): boolean {
  const heroes = p.units.filter((u) => u.side === 'hero' && alive(p, u)).map((u) => posOf(p, u));
  const near = (f: Unit): number => Math.min(...heroes.map((h) => dist(h, posOf(p, f))));
  const first = p.units.filter((f) => f.side === 'foe' && f.asleep && alive(p, f)).sort((a, b) => near(a) - near(b))[0];
  if (!first || !heroes.length) return false;
  for (const f of p.units) if (f.side === 'foe' && f.group === first.group && alive(p, f)) { f.asleep = false; f.alertUntil = t + 600; f.nextAt = Math.max(f.nextAt, t + 0.5); }
  return true;
}
