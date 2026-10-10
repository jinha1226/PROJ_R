import { DIRS, canStep, dist, idx, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, canHit, occupied, posOf, stats, strike, type Party, type Unit } from './partyCore';
import { knows } from './brain';

const foesAwake = (p: Party): Unit[] => p.units.filter((f) => f.side === 'foe' && alive(p, f) && !f.asleep);
const key = (c: Cell): string => `${c.x},${c.y}`;
/** how many of a cell's eight neighbours can be walked (two: the inside of a passage one cell wide) */
const openSides = (p: Party, c: Cell): number => DIRS.filter((d) => walkable(tileAt(p.s.map, { x: c.x + d.x, y: c.y + d.y }))).length;

/**
 * Shooting first: out of a fight, a clone with a ranged weapon looses at a foe in sight that has not noticed it yet, from
 * as far as the weapon reaches (the blow wakes the band: the fight begins with one of them already hurt).
 */
export function snipe(p: Party, u: Unit, t: number, ev: GEvent[]): boolean {
  if (p.combat !== false || !knows('snipe') || stats(u, t, p).range <= 1) return false;
  const me = posOf(p, u);
  const prey = p.units.filter((f) => f.side === 'foe' && f.asleep && alive(p, f) && p.s.visible.has(idx(p.s.map, posOf(p, f))) && canHit(p, u, f))
    .sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
  if (!prey) return false;
  u.order = null;
  ev.push({ t, type: 'buff', src: u.id, dst: prey.id, text: '먼저 쏘기' });
  strike(p, u, prey, t, ev);
  return true;
}

/** how far a clone will walk for a narrow place (steps) */
const CHOKE_STEPS = 4;
/** with nothing in reach for this long, the clone gives the narrow place up and goes to the foes */
const CHOKE_WAIT = 4;

/**
 * Taking a band in a narrow place: as a fight begins, a clone that knows how walks to the inside of a passage one cell
 * wide a few steps off (never one nearer the foes than where it stands) and holds there, so they come at it one at a
 * time. Once a fight; if the foes do not come, it gives the place up.
 */
export function takeChoke(p: Party, u: Unit, t: number, ev: GEvent[]): void {
  if (!p.combat) { u.chokeAt = undefined; return; }
  if (!knows('choke')) return;
  const foes = foesAwake(p);
  if (u.chokeAt !== undefined) {
    if (foes.some((f) => canHit(p, u, f))) u.chokeAt = t;
    else if (u.order?.kind === 'hold' && t - u.chokeAt > CHOKE_WAIT) u.order = null;
    return;
  }
  u.chokeAt = t;
  if (u.order || foes.length < 2) return;
  const me = posOf(p, u), far = (c: Cell): number => Math.min(...foes.map((f) => dist(posOf(p, f), c)));
  if (openSides(p, me) <= 2) { u.order = { kind: 'hold', cell: { ...me } }; return; }
  // the nearest passage cell by steps (breadth first), the one farther from the foes on a tie
  const seen = new Set([key(me)]);
  let ring: Cell[] = [me], spot: Cell | undefined;
  for (let step = 1; step <= CHOKE_STEPS && !spot; step++) {
    const next: Cell[] = [];
    for (const c of ring) for (const d of DIRS) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      if (seen.has(key(n)) || !canStep(p.s.map, c, d) || occupied(p, n, u.id)) continue;
      seen.add(key(n)); next.push(n);
    }
    spot = next.filter((c) => openSides(p, c) <= 2 && far(c) >= far(me)).sort((a, b) => far(b) - far(a))[0];
    ring = next;
  }
  if (!spot) return;
  u.order = { kind: 'move', cell: spot };
  ev.push({ t, type: 'buff', src: u.id, text: '길목에서 받기' });
}
