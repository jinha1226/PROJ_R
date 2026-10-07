import { DIRS, dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, entOf, occupied, posOf, strike, type Party, type Unit } from './partyCore';
import { emit } from './triggers';
import { resonant } from './resonance';
import { duoFor } from './cardsCombo';

/** The living units of a side within `r` cells of a cell. */
/** an awake foe within eight: the clone is fighting (sustained laws wait for a fight) */
export const fighting = (p: Party, u: Unit): boolean => p.units.some((f) => f.side === 'foe' && alive(p, f) && !f.asleep && dist(posOf(p, f), posOf(p, u)) <= 8);
export const foesNear = (p: Party, at: Cell, r: number, side: 'foe' | 'hero' = 'foe'): Unit[] =>
  p.units.filter((x) => x.side === side && alive(p, x) && dist(posOf(p, x), at) <= r);

/** A counter blow: a strike that is not the clone's own attack, doubled with the second shield law; others can hang on it. */
export function counter(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[], mult = 1): void {
  if (!alive(p, u) || !alive(p, target)) return;
  strike(p, u, target, t, ev, mult * (resonant(p, u, '방패', 2) ? 2 : 1) * (u.shield > 0 && duoFor(p, u, 'holyShield') ? 2 : 1), false);
  emit(p, 'counter', { t, src: u, target, ev });
}

/** Steps a clone into a free cell beside a foe (a blink); false when there is none. */
export function stepBehind(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[]): boolean {
  if (!alive(p, u) || !alive(p, target)) return false;
  const tp = posOf(p, target), spot = DIRS.map((d) => ({ x: tp.x + d.x, y: tp.y + d.y })).find((c) => walkable(tileAt(p.s.map, c)) && !occupied(p, c, u.id));
  if (!spot) return false;
  const move: GEvent = { t, type: 'teleport', src: u.id, from: { ...posOf(p, u) }, to: spot };
  ev.push(move); entOf(p, u.id)!.pos = spot; u.steady = 0; u.still = 0; p.onMovement?.([move], ev);
  emit(p, 'teleport', { t, src: u, ev });
  return true;
}

/** Gives back health directly (undoing a blow), whatever blocks healing. */
export function restore(p: Party, u: Unit, n: number): void {
  const e = entOf(p, u.id);
  if (e?.alive) { e.hp = Math.min(e.maxHp, e.hp + Math.round(n)); u.lowHp = e.hp < e.maxHp / 2; }
}

/** The living clone with the smallest share of its health. */
export const mostHurt = (p: Party): Unit | undefined => p.units.filter((x) => x.side === 'hero' && alive(p, x))
  .sort((a, b) => entOf(p, a.id)!.hp / entOf(p, a.id)!.maxHp - entOf(p, b.id)!.hp / entOf(p, b.id)!.maxHp)[0];
