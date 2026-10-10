import { dist, idx, same, type GEvent } from '../grid/types';
import { alive, canHit, entOf, posOf, stats, stepToward, strike, type Party, type Unit } from './partyCore';

/**
 * `?demo=swarm` (2026-10-10, the dungeon-crawl-meets-survivors idea): the clone the player leads is only ever told to walk
 * or to wait, and each of those is a turn. In every turn it takes, a foe in sight within its weapon's reach is struck —
 * from where it stands, so a step back still has its blow; if nothing was in reach, from where the step brings it — and
 * the clone never steps anywhere by itself. A turn with a blow in it lasts as long as the weapon's blow does (a slow weapon
 * gives the foes more time). Walking into a foe is a clash: the foe strikes, the clone strikes harder than usual, and the
 * cell is taken only if the foe falls. Its potions and ultimates are the player's to use, a turn each. Off everywhere else.
 */
export const AUTOHIT = { on: false };
/** a turn spent standing */
const WAIT = 0.5;
/** a blow thrown by walking into a foe, against the usual */
export const BUMP = 1.5;

/** the nearest foe in sight within the weapon's reach is struck (false: nothing in reach) */
function blow(p: Party, u: Unit, t: number, ev: GEvent[]): boolean {
  const me = posOf(p, u);
  const foe = p.units.filter((f) => f.side === 'foe' && alive(p, f) && p.s.visible.has(idx(p.s.map, posOf(p, f))) && canHit(p, u, f))
    .sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
  if (foe) strike(p, u, foe, t, ev);
  return !!foe;
}

/** The led clone's turn while blows land by themselves: a clash, or the blow and a step of the walk it was told; how long the turn lasts. */
export function autoHitTurn(p: Party, u: Unit, t: number, ev: GEvent[]): number {
  const e = entOf(p, u.id)!, st = stats(u, t, p), order = u.order;
  if (order && order.kind !== 'move') u.order = null;
  // walked into a foe at its side: the foe's blow (if it is up to one), then the clone's, harder; the foe down, the clone takes its cell
  const into = order?.kind === 'attack' ? p.units.find((f) => f.id === order.target && f.side === 'foe' && alive(p, f) && dist(posOf(p, f), e.pos) <= 1) : undefined;
  if (into) {
    const at = { ...posOf(p, into) }, up = !into.asleep && (into.status.stun?.until ?? 0) <= t && (into.status.freeze?.until ?? 0) <= t;
    if (up) strike(p, into, u, t, ev, 1, false);
    if (!alive(p, u)) return st.atk;
    ev.push({ t, type: 'buff', src: u.id, dst: into.id, text: '들이받기' });
    strike(p, u, into, t, ev, BUMP);
    if (!alive(p, into) && alive(p, u)) { u.order = { kind: 'move', cell: at }; stepToward(p, u, at, t, ev); u.order = null; }
    return Math.max(st.atk, st.move);
  }
  let hit = blow(p, u, t, ev), spent = WAIT;
  if (!alive(p, u)) return st.atk;
  if (u.order?.kind === 'move') {
    const cell = u.order.cell;
    if (!same(e.pos, cell) && stepToward(p, u, cell, t, ev)) spent = st.move; else u.order = null;
    if (u.order && same(e.pos, cell)) u.order = null;
    if (!hit && alive(p, u)) hit = blow(p, u, t, ev);
  }
  return hit ? Math.max(spent, st.atk) : spent;
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
