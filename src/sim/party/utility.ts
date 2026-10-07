import { findPath } from '../grid/path';
import { dist, type GEvent } from '../grid/types';
import { alive, ENGAGE, entOf, hitChance, occupied, posOf, stats, targetOf, type Party, type Unit } from './partyCore';
import { movedStatus, type StatusId } from './status';
import { mods } from './traitMods';
import { rank } from './traitTypes';
import { duoFor } from './cardsSupport';
import { linesOf } from './body';
import { emit } from './triggers';
import { WEAPONS } from './partyDefs';
import { nextElement as mageNext } from './cardsMage';

/** how far a melee clone's basic attack leaps in to strike (cells) */
export const CHARGE = 3;
/** a clone sticks with the foe it chose unless another scores this much better */
const STICK = 1.35;
const REACTIONS: [StatusId, StatusId][] = [['burn', 'chill'], ['burn', 'shock'], ['chill', 'shock'], ['burn', 'poison']];
/** cards that pay off a kill, and cards that pay off a mark */
const ON_KILL = ['finish', 'bloodthirst', 'shadowStep', 'morale', 'plunder', 'poisonNova'];
const ON_MARK = ['multiShot', 'hunterInstinct'];

const on = (u: Unit, id: StatusId, t: number) => (u.status[id]?.until ?? 0) > t;
const states = (u: Unit, t: number) => Object.values(u.status).filter((s) => (s?.until ?? 0) > t).length;
/** the element this clone's next blow will lay (the mage's elemental cycle), if it has one */
const nextElement = (u: Unit): StatusId | undefined => (linesOf(u).includes('mage') ? mageNext(u) : undefined);

/**
 * How much good a blow on this foe would do now (utility AI): the share of its health it takes, a kill and what the
 * clone's cards make of one, the states on it that the clone's cards feed on (marks, burns, freezes, stuns, many states),
 * a reaction the clone's next element would set off, the crowd round it for blasts, the ally it threatens — less the
 * walking it takes to get there (a melee charge reaches three cells).
 */
export function utility(p: Party, u: Unit, f: Unit, t: number): number {
  const fe = entOf(p, f.id)!, st = stats(u, t, p), me = posOf(p, u), at = posOf(p, f);
  const reach = st.range <= 1 ? CHARGE : st.range, expected = ((st.dmg[0] + st.dmg[1]) / 2) * hitChance(p, u, f, t);
  const crowd = p.units.filter((x) => x !== f && x.side === f.side && alive(p, x) && dist(posOf(p, x), at) <= 1).length;
  let s = Math.min(1, expected / Math.max(1, fe.hp)) * 10;
  if (expected >= fe.hp) s += 6 + 3 * ON_KILL.filter((id) => rank(u, id)).length + (on(f, 'burn', t) && rank(u, 'fireSpread') ? 3 : 0);
  s += states(f, t) * (rank(u, 'vitals') ? 2.5 : 0.4);
  if (on(f, 'mark', t)) s += 1 + 3 * ON_MARK.filter((id) => rank(u, id)).length + (duoFor(p, u, 'lightArrow') || duoFor(p, u, 'prey') ? 2 : 0);
  if (on(f, 'burn', t) && rank(u, 'fireSpread')) s += 2 + 2 * crowd;
  if (on(f, 'freeze', t) && (linesOf(u).includes('mage') || duoFor(p, u, 'shatterDuo'))) s += 4;
  if (on(f, 'stun', t) && duoFor(p, u, 'gap')) s += 3;
  if (on(f, 'bleed', t) && duoFor(p, u, 'bloodFeast')) s += 1.5;
  const next = nextElement(u);
  if (next) for (const [a, b] of REACTIONS) if ((a === next && on(f, b, t)) || (b === next && on(f, a, t))) s += 3 * (1 + (mods(u).react ?? 0));
  const splash = (u.spinUntil ?? 0) > t || (u.weapon && (WEAPONS[u.weapon].cleave || WEAPONS[u.weapon].splash));
  s += crowd * (splash ? 1 : 0.3);
  const aim = targetOf(p, f, t);
  // a ranged clone deals with the foe that is on top of it
  if (st.range > 1 && dist(me, at) <= 1) s += 4;
  if (aim && aim.side === u.side && aim !== u) {
    const ae = entOf(p, aim.id)!;
    if (ae.hp < ae.maxHp / 2) s += 2.5;
  }
  return s - Math.max(0, dist(me, at) - reach) * 1.5;
}

/** The foe a companion goes for: the best blow now, sticking with its last choice unless another is clearly better. */
export function bestTarget(p: Party, u: Unit, t: number): Unit | undefined {
  const me = posOf(p, u);
  const foes = p.units.filter((x) => x.side !== u.side && alive(p, x) && !x.asleep && dist(posOf(p, x), me) <= ENGAGE);
  if (!foes.length) return undefined;
  const scored = foes.map((f) => ({ f, s: utility(p, u, f, t) })).sort((a, b) => b.s - a.s);
  const kept = scored.find((x) => x.f.id === u.aiTarget);
  const pick = kept && kept.s * STICK >= scored[0]!.s ? kept.f : scored[0]!.f;
  u.aiTarget = pick.id;
  return pick;
}

/** A melee basic attack's leap: into the free cell before a foe two or three cells off; false when there is no such way. */
export function charge(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[]): boolean {
  const e = entOf(p, u.id)!, to = posOf(p, target), d = dist(e.pos, to);
  if (d < 2 || d > CHARGE) return false;
  const path = findPath(p.s.map, e.pos, to, (c) => occupied(p, c, u.id));
  if (!path || path.length < 2 || path.length > CHARGE) return false;
  const land = path[path.length - 2]!;
  if (occupied(p, land, u.id)) return false;
  ev.push({ t, type: 'move', src: u.id, from: { ...e.pos }, to: { ...land }, text: 'dash' });
  e.pos = { ...land };
  u.moved = true; u.still = 0; movedStatus(p, u, t, ev); emit(p, 'moved', { t, src: u, ev });
  return true;
}
