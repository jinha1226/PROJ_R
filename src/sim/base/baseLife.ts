import { dist, idx, same, tileAt, walkable, type Cell } from '../grid/types';
import { occupied, posOf } from '../party/partyCore';
import { living } from '../roam/roam';
import type { WorldParty } from '../overworld/worldSim';

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

/**
 * Base mode (spec 2026-10-08 §1): the clones at home live about the base — an idle one strolls to a free claimed cell near
 * the pod, then rests a few turns before the next. A clone with a post goes to it and stands there instead.
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
    if (!stroll || p.raidReady || u.order || (u.idleAt ?? 0) > t) continue;
    u.idleAt = t + 3 + p.s.rng.int(0, 4);
    const spot = homeSpot(p, posOf(p, u));
    if (spot) u.order = { kind: 'move', cell: spot };
  }
}
