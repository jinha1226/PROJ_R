import { losClear } from './fov';
import { dist, opaque, same, tileAt, type Cell, type Ent, type GEvent, type GridMap, type GridState } from './types';

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

export function hitChance(m: GridMap, from: Cell, to: Cell, base: number): number {
  const p = base - PER_TILE * (dist(from, to) - 1) - (inCover(m, from, to) ? COVER : 0);
  return Math.max(MIN_HIT, Math.round(p * 1000) / 1000);
}

/** Living entities other than `except` block a shot. */
export function bodyAt(s: GridState, c: Cell): Ent | undefined {
  if (s.hero.alive && same(s.hero.pos, c)) return s.hero;
  return s.foes.find((f) => f.alive && same(f.pos, c));
}

export function shotClear(s: GridState, from: Cell, to: Cell): boolean {
  return losClear(s.map, from, to, (c) => !!bodyAt(s, c));
}

/** Rolls to hit and for damage; emits hit/miss (+die). Returns whether it hit. */
export function strike(s: GridState, t: number, src: Ent, dst: Ent, chance: number, dmg: readonly [number, number]): boolean {
  if (!s.rng.chance(chance)) {
    s.events.push({ t, type: 'miss', src: src.id, dst: dst.id, to: { ...dst.pos } });
    return false;
  }
  const amount = s.rng.int(dmg[0], dmg[1]);
  dst.hp -= amount;
  const ev: GEvent = { t, type: 'hit', src: src.id, dst: dst.id, amount, to: { ...dst.pos } };
  if (amount === dmg[1]) ev.crit = true;
  s.events.push(ev);
  if (dst.hp <= 0) {
    dst.hp = 0;
    dst.alive = false;
    s.events.push({ t, type: 'die', src: src.id, dst: dst.id, to: { ...dst.pos } });
  }
  return true;
}
