import { hitChance, shotClear, strike } from './combat';
import { chestAt } from './actions';
import { findPath } from './path';
import { add, canStep, DIRS, dist, FOES, same, type Cell, type Ent, type GridState } from './types';

export { DANGER, EXIT_TIME } from './danger';

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
  if (f.kind === 'archer') return archerTurn(s, f, t);
  if (canMelee(s, f)) {
    s.events.push({ t, type: 'bump', src: f.id, dst: s.hero.id, from: { ...f.pos }, to: { ...s.hero.pos } });
    strike(s, t, f, s.hero, def.hit, def.dmg);
    return 1;
  }
  if (!stepToward(s, f, f.lastSeen ?? s.hero.pos, t)) return 1;
  return def.move;
}

/** Free neighbouring cells a foe could step to. */
function steps(s: GridState, f: Ent): Cell[] {
  return DIRS.filter((d) => canStep(s.map, f.pos, d)).map((d) => add(f.pos, d)).filter((c) => !blockedFor(s, f)(c));
}

function moveTo(s: GridState, f: Ent, to: Cell, t: number): void {
  s.events.push({ t, type: 'move', src: f.id, from: { ...f.pos }, to: { ...to } });
  f.pos = to;
}

/** Archers keep 3–6 tiles away, shoot when the line is clear, and walk to a spot with a clear line when it is not. */
function archerTurn(s: GridState, f: Ent, t: number): number {
  const def = FOES.archer;
  const h = s.hero.pos;
  const d = dist(f.pos, h);
  if (d <= 2) {
    const away = steps(s, f).sort((a, b) => dist(b, h) - dist(a, h))[0];
    if (away && dist(away, h) > d) { moveTo(s, f, away, t); return def.move; }
    if (canMelee(s, f)) {
      s.events.push({ t, type: 'bump', src: f.id, dst: s.hero.id, from: { ...f.pos }, to: { ...h } });
      strike(s, t, f, s.hero, def.hit, [1, 2]);
      return 1;
    }
  }
  if (d <= def.range && shotClear(s, f.pos, h)) {
    s.events.push({ t, type: 'shoot', src: f.id, dst: s.hero.id, from: { ...f.pos }, to: { ...h } });
    strike(s, t, f, s.hero, hitChance(s.map, f.pos, h, def.hit), def.dmg);
    return 1;
  }
  // a neighbouring cell with a clear line in the 3–6 band, else close in
  const spot = steps(s, f).filter((c) => dist(c, h) >= 3 && dist(c, h) <= 6 && shotClear(s, c, h)).sort((a, b) => dist(a, h) - dist(b, h))[0];
  if (spot) { moveTo(s, f, spot, t); return def.move; }
  return stepToward(s, f, f.lastSeen ?? h, t) ? def.move : 1;
}
