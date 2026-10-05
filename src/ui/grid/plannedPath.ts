import { stepBlocked, walkBlocked } from '../../sim/grid/actions';
import { findPath } from '../../sim/grid/path';
import { idx, tileAt, walkable, type Cell, type GridState } from '../../sim/grid/types';

/** The way a click (or auto-explore) walks to `c`: round known traps if it can, cross one only if it must; never through unseen cells when `seenOnly`. */
export function plannedPath(s: GridState, c: Cell, seenOnly = false): Cell[] | null {
  if (!walkable(tileAt(s.map, c))) return null;
  const unseen = (p: Cell) => seenOnly && !s.seen[idx(s.map, p)];
  return findPath(s.map, s.hero.pos, c, (p) => walkBlocked(s, p) || unseen(p)) ?? findPath(s.map, s.hero.pos, c, (p) => stepBlocked(s, p) || unseen(p));
}
