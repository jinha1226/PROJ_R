import { strike } from './combat';
import { chestAt } from './actions';
import { findPath } from './path';
import { canStep, dist, FOES, same, type Cell, type Ent, type GridState } from './types';

/** Cells a foe may not walk into: other bodies and chests. */
export const blockedFor = (s: GridState, self: Ent) => (c: Cell): boolean =>
  !!chestAt(s, c) || s.foes.some((f) => f !== self && f.alive && same(f.pos, c)) || (s.hero.alive && same(s.hero.pos, c));

/** Steps one cell along a path toward `to`; false if there is no way. */
export function stepToward(s: GridState, f: Ent, to: Cell, t: number): boolean {
  const path = findPath(s.map, f.pos, to, blockedFor(s, f), 60);
  const next = path?.[0];
  if (!next || same(next, s.hero.pos) || blockedFor(s, f)(next)) return false;
  s.events.push({ t, type: 'move', src: f.id, from: { ...f.pos }, to: { ...next } });
  f.pos = next;
  return true;
}

/** Adjacent, and not across a wall corner. */
export function canMelee(s: GridState, f: Ent): boolean {
  const d = { x: s.hero.pos.x - f.pos.x, y: s.hero.pos.y - f.pos.y };
  return dist(f.pos, s.hero.pos) === 1 && (d.x === 0 || d.y === 0 || canStep(s.map, f.pos, d));
}

/** One foe turn; returns its time cost. */
export function foeTurn(s: GridState, f: Ent): number {
  const t = f.nextAt;
  const def = FOES[f.kind as keyof typeof FOES];
  if (!f.awake) return 1;
  if (canMelee(s, f)) {
    s.events.push({ t, type: 'bump', src: f.id, dst: s.hero.id, from: { ...f.pos }, to: { ...s.hero.pos } });
    strike(s, t, f, s.hero, def.hit, def.dmg);
    return 1;
  }
  if (!stepToward(s, f, f.lastSeen ?? s.hero.pos, t)) return 1;
  return def.move;
}
