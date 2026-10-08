import { dist, idx, same, tileAt, walkable, type Cell } from '../grid/types';
import { occupied, posOf } from '../party/partyCore';
import { living } from '../roam/roam';
import type { WorldParty } from '../overworld/worldSim';
import { upgradeOn } from './modules';
import { targets } from './raidPath';

/** how far from the pod the clones at home wander */
export const HOME_RANGE = 6;

/** a free claimed floor cell within reach of the pod, picked at random (none: undefined) */
function homeSpot(p: WorldParty, near: Cell): Cell | undefined {
  const m = p.s.map, out: Cell[] = [];
  for (let dy = -HOME_RANGE; dy <= HOME_RANGE; dy++) for (let dx = -HOME_RANGE; dx <= HOME_RANGE; dx++) {
    const c = { x: p.base.x + dx, y: p.base.y + dy };
    if (dist(c, p.base) <= HOME_RANGE && dist(c, near) >= 2 && walkable(tileAt(m, c)) && p.claimed[idx(m, c)] && !occupied(p, c, '')) out.push(c);
  }
  return out.length ? out[p.s.rng.int(0, out.length - 1)] : undefined;
}

/** a free cell right beside the pod or a standing module, picked at random: where a clone at home works (none: undefined) */
function workSpot(p: WorldParty): Cell | undefined {
  const out: Cell[] = [];
  for (const t of targets(p)) for (const c of t.cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const n = { x: c.x + dx, y: c.y + dy };
    if (walkable(tileAt(p.s.map, n)) && !occupied(p, n, '') && !p.units.some((u) => (u.post && same(u.post, n)) || (u.workCell && same(u.workCell, n)))) out.push(n);
  }
  return out.length ? out[p.s.rng.int(0, out.length - 1)] : undefined;
}

/**
 * Base mode (spec 2026-10-08 §1): the clones at home live about the base — an idle one strolls to a free claimed cell near
 * the pod, then rests a few turns before the next; with the core's gathering switched on it goes to work beside the pod or
 * a module instead (a swing every couple of turns). A clone with a post goes to it and stands there.
 */
export function homeLife(p: WorldParty, t: number, stroll = true): void {
  if (p.raid || p.combat || p.away) return;
  for (const u of living(p)) {
    // a clone with a post keeps to it: it walks there (now and then trying again when the way is shut) and stands
    if (u.post) {
      const at = same(posOf(p, u), u.post);
      if (at && !u.order) u.order = { kind: 'hold', cell: { ...u.post } };
      else if (!at && u.order?.kind !== 'move' && (u.idleAt ?? 0) <= t) { u.idleAt = t + 4; u.order = { kind: 'move', cell: { ...u.post } }; }
      continue;
    }
    // nobody strolls on a raid night (or while told not to: the posts are being given out)
    if (!stroll || p.raidReady) continue;
    // at work (the core's gathering on): a clone at its spot by the pod or a module swings away until its rest is over
    if (u.workCell && same(posOf(p, u), u.workCell) && (u.idleAt ?? 0) > t) {
      if (u.order?.kind !== 'hold') u.order = { kind: 'hold', cell: { ...u.workCell } };
      if ((u.workAt ?? 0) <= t) { u.workAt = t + 2.4; p.baseEvents.push({ t, type: 'buff', src: u.id, dst: u.id, text: 'work' }); }
      continue;
    }
    if (u.workCell && u.order?.kind === 'hold') u.order = null;
    if (u.order || (u.idleAt ?? 0) > t) continue;
    const work = upgradeOn(p, 'gather') ? workSpot(p) : undefined;
    u.workCell = work;
    u.idleAt = t + (work ? 12 : 3) + p.s.rng.int(0, 4);
    const spot = work ?? homeSpot(p, posOf(p, u));
    if (spot) u.order = { kind: 'move', cell: spot };
  }
}
