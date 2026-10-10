import { dist, idx, same, type GEvent } from '../grid/types';
import { alive, canHit, entOf, posOf, stats, stepToward, strike, type Party, type Unit } from './partyCore';

/**
 * `?demo=swarm` (2026-10-10, the dungeon-crawl-meets-survivors idea): the clone the player leads is only ever told to walk
 * or to wait, and each of those is a turn. In every turn it takes, a foe in sight within its weapon's reach is struck —
 * after the step, from where it then stands — and the clone never steps anywhere by itself. A turn with a blow in it lasts
 * as long as the weapon's blow does (a slow weapon gives the foes more time). Its potions and ultimates are the player's to
 * use, a turn each. Off everywhere else.
 */
export const AUTOHIT = { on: false };
/** a turn spent standing */
const WAIT = 0.5;

/** The led clone's turn while blows land by themselves: a step of the walk it was told (if any), then the blow; how long the turn lasts. */
export function autoHitTurn(p: Party, u: Unit, t: number, ev: GEvent[]): number {
  const e = entOf(p, u.id)!, st = stats(u, t, p);
  // nothing but a walk is ever asked of it (a blow aimed by hand is a turn spent standing: the blow lands by itself)
  if (u.order && u.order.kind !== 'move') u.order = null;
  let spent = WAIT;
  if (u.order?.kind === 'move') {
    const cell = u.order.cell;
    if (!same(e.pos, cell) && stepToward(p, u, cell, t, ev)) spent = st.move; else u.order = null;
    if (u.order && same(e.pos, cell)) u.order = null;
  }
  if (!alive(p, u)) return spent;
  const foe = p.units.filter((f) => f.side === 'foe' && alive(p, f) && p.s.visible.has(idx(p.s.map, posOf(p, f))) && canHit(p, u, f))
    .sort((a, b) => dist(posOf(p, a), e.pos) - dist(posOf(p, b), e.pos))[0];
  if (!foe) return spent;
  strike(p, u, foe, t, ev);
  return Math.max(spent, st.atk);
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
