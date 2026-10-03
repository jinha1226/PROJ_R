import { losClear } from './fov';
import { defend } from './defense';
import { dist, opaque, same, tileAt, walkable, type Cell, type Ent, type GEvent, type GridMap, type GridState } from './types';

const PER_TILE = 0.04;
const COVER = 0.3;
const MIN_HIT = 0.05;

/** Is the target tucked beside a wall or pillar on the shooter's side? */
export function inCover(m: GridMap, shooter: Cell, target: Cell): boolean {
  const dx = Math.sign(shooter.x - target.x);
  const dy = Math.sign(shooter.y - target.y);
  const sides: Cell[] = [];
  if (dx) sides.push({ x: target.x + dx, y: target.y });
  if (dy) sides.push({ x: target.x, y: target.y + dy });
  if (dx && dy) sides.push({ x: target.x + dx, y: target.y + dy });
  // only cover that is not right next to the shooter (point-blank ignores cover)
  return dist(shooter, target) > 1 && sides.some((c) => opaque(tileAt(m, c)));
}

export function hitChance(m: GridMap, from: Cell, to: Cell, base: number, coverMul = 1): number {
  const p = base - PER_TILE * (dist(from, to) - 1) - (inCover(m, from, to) ? COVER * coverMul : 0);
  return Math.max(MIN_HIT, Math.round(p * 1000) / 1000);
}

/** Living entities other than `except` block a shot. */
export function bodyAt(s: GridState, c: Cell): Ent | undefined {
  if (s.hero.alive && same(s.hero.pos, c)) return s.hero;
  return s.foes.find((f) => f.alive && same(f.pos, c));
}

export const foeAt = (s: GridState, c: Cell): Ent | undefined => s.foes.find((f) => f.alive && same(f.pos, c));

/** A cell something can be pushed or step into: open floor (no shut door), nobody there, no shut chest or barrel. */
export const freeCell = (s: GridState, c: Cell): boolean =>
  walkable(tileAt(s.map, c)) && tileAt(s.map, c) !== 'door' && !bodyAt(s, c) && !s.chests.some((ch) => !ch.opened && same(ch.pos, c)) && !s.barrels.some((b) => same(b, c));

/** A shot line, the same both ways (a line traced from either end counts), bodies in between block it. */
export function shotClear(s: GridState, from: Cell, to: Cell): boolean {
  const bodies = (c: Cell) => !!bodyAt(s, c) || s.barrels.some((b) => same(b, c));
  return losClear(s.map, from, to, bodies, s) || losClear(s.map, to, from, bodies, s);
}

/** Rolls to hit and for damage; emits hit/miss (+die). Returns whether it hit. */
/** mult: sneak-attack multiplier; the hero's armour takes its share off (never below 1). */
export function strike(s: GridState, t: number, src: Ent, dst: Ent, chance: number, dmg: readonly [number, number], mult = 1, kind?: 'melee' | 'shot'): boolean {
  // a foe's blow or shot at the hero may be parried or dodged first
  if (kind && dst.id === s.hero.id && defend(s, t, src.id, kind)) return false;
  if (!s.rng.chance(chance)) {
    s.events.push({ t, type: 'miss', src: src.id, dst: dst.id, to: { ...dst.pos } });
    return false;
  }
  const roll = s.rng.int(dmg[0], dmg[1]);
  const armour = dst.id === s.hero.id ? s.hero.gear.armor?.reduce ?? 0 : 0;
  const amount = Math.max(1, Math.round(roll * mult) - armour);
  dst.hp -= amount;
  const ev: GEvent = { t, type: 'hit', src: src.id, dst: dst.id, amount, to: { ...dst.pos } };
  // small engraving boosts (a mark, last stand) are not crits; sneak attacks and finishers are
  if (roll === dmg[1] || mult >= 1.5) ev.crit = true;
  s.events.push(ev);
  if (dst.hp <= 0) {
    dst.hp = 0;
    dst.alive = false;
    s.events.push({ t, type: 'die', src: src.id, dst: dst.id, to: { ...dst.pos } });
  }
  return true;
}
