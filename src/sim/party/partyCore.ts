import { shotClear } from '../grid/combat';
import { findPath } from '../grid/path';
import { dist, idx, opaque, same, tileAt, type Cell, type Ent, type GEvent, type GridState } from '../grid/types';
import { CLASSES, FOES, PROMOTIONS, WEAPONS, type BaseClass, type ClassId, type FoeId, type WeaponId } from './partyDefs';
import { PROMOTE_LEVEL, T, type TraitId } from './partyTraits';

export type Order = { kind: 'attack'; target: string } | { kind: 'move'; cell: Cell } | { kind: 'hold'; cell: Cell } | null;

export interface Unit {
  id: string; side: 'hero' | 'foe'; cls?: ClassId; weapon?: WeaponId; foe?: FoeId;
  nextAt: number; order: Order; ready: [number, number]; queued?: 0 | 1;
  tauntUntil: number; tauntBy?: string;
  /** soaks blows before health */
  shield: number;
  hiddenUntil: number; hasteUntil: number; frozenUntil: number;
  /** the next strike's multiplier (stealth) */
  empower: number;
  /** when a cleric's guardian ward may fire again */
  guardReady: number;
  /** kills that count toward this hero's advanced class */
  progress: number; promoteReady?: boolean;
  /** a camp foe that has not noticed the party yet (takes no turns) */
  asleep?: boolean;
  /** the camp a foe belongs to (they wake together) */
  group?: number;
  /** the soul a hero carries (what drops where it falls) */
  soul?: BaseClass;
  /** a fallen foe whose bio-matter has been gathered */
  reaped?: boolean;
  /** a soul's growth: level, experience, traits taken, picks not yet spent and the three on offer */
  level?: number; xp?: number; traits?: Partial<Record<TraitId, number>>; picks?: number; offer?: TraitId[];
  /** when grit can hold a killing blow again */
  gritReady?: number;
  /** the cell an archer last shot from and how many shots in a row from it (steady aim) */
  steadyAt?: Cell; steady?: number;
  /** a companion uses its skills by itself (on unless the player turns it off) */
  manualSkills?: boolean;
}
export interface Party {
  s: GridState; units: Unit[]; time: number; wave: number;
  /** on the world map: false while no awake foe is near (orders then move the whole party; arrival does not hold) */
  combat?: boolean;
  /** the hero the others follow out of combat */
  leader?: string;
  /** world-map rules turn on (targets only awake foes nearby) */
  roam?: boolean;
  /** cells of waist-high cover (boulders, low walls, barricades) beside walls and trees */
  cover?: Uint8Array;
  /** turn-based fighting: the clone under the player's hand; time stops on its moment until it is given something to do */
  manual?: string;
  /** time is stopped, waiting for the manual clone's command */
  waiting?: boolean;
}

export const entOf = (p: Party, id: string): Ent | undefined => (id === 'hero' ? p.s.hero : p.s.foes.find((f) => f.id === id));
export const unitOf = (p: Party, id: string): Unit | undefined => p.units.find((u) => u.id === id);
export const alive = (p: Party, u: Unit): boolean => entOf(p, u.id)?.alive ?? false;
export const posOf = (p: Party, u: Unit): Cell => entOf(p, u.id)!.pos;
export const roll = (p: Party, r: [number, number]): number => p.s.rng.int(r[0], r[1]);
export const occupied = (p: Party, c: Cell, self: string): boolean => p.units.some((u) => u.id !== self && alive(p, u) && same(posOf(p, u), c));
const passive = (u: Unit) => (u.cls ? CLASSES[u.cls].passive : undefined);

/** What a unit's basic attack is: the hero's weapon, or the foe's kind. */
export function stats(u: Unit, t = 0): { dmg: [number, number]; range: number; atk: number; move: number } {
  if (!u.cls) return FOES[u.foe!];
  const w = WEAPONS[u.weapon!];
  const range = (w.range > 1 && passive(u) === 'farShot' ? w.range + 2 : w.range) + (w.range > 1 ? T.range(u) : 0);
  return { dmg: w.dmg, range, atk: w.atk * (t < u.hasteUntil ? 0.5 : 1) * T.atk(u), move: CLASSES[u.cls].move * T.move(u) };
}

export function canHit(p: Party, u: Unit, target: Unit, range = stats(u).range): boolean {
  const a = posOf(p, u), b = posOf(p, target), d = dist(a, b);
  return d <= range && (range <= 1 ? d === 1 : shotClear(p.s, a, b));
}

/** Who a unit goes for: a taunt, its order, else the nearest unhidden foe of the other side. */
export function targetOf(p: Party, u: Unit, t: number): Unit | undefined {
  if (u.side === 'foe' && u.tauntBy && t < u.tauntUntil) { const by = p.units.find((x) => x.id === u.tauntBy && alive(p, x)); if (by) return by; }
  if (u.order?.kind === 'attack') { const id = u.order.target; const o = p.units.find((x) => x.id === id && alive(p, x)); if (o) return o; u.order = null; }
  const me = posOf(p, u);
  return p.units.filter((x) => x.side !== u.side && alive(p, x) && !(x.side === 'hero' && t < x.hiddenUntil) && !(p.roam && (x.asleep || dist(posOf(p, x), me) > 10))).sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
}

/** One step toward `to` along a free path (other bodies block, the goal itself does not). */
export function stepToward(p: Party, u: Unit, to: Cell, t: number, ev: GEvent[]): boolean {
  const e = entOf(p, u.id)!;
  const next = findPath(p.s.map, e.pos, to, (c) => occupied(p, c, u.id))?.[0];
  if (!next || occupied(p, next, u.id)) return false;
  ev.push({ t, type: 'move', src: u.id, from: { ...e.pos }, to: { ...next } });
  e.pos = next;
  return true;
}

/** The class engravings that scale a hero's blow on this target. */
export function passiveMult(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[]): number {
  const me = entOf(p, u.id)!, te = entOf(p, target.id)!;
  switch (passive(u)) {
    case 'firstShot': return te.hp === te.maxHp ? 2 : 1;
    case 'shatter': if (t < target.frozenUntil) { target.frozenUntil = 0; ev.push({ t, type: 'react', src: u.id, to: { ...te.pos }, text: 'shatter' }); return 2; } return 1;
    case 'flank': return targetOf(p, target, t)?.id !== u.id ? 1.6 : 1;
    case 'rage': return me.hp < me.maxHp / 2 ? 1.5 : 1;
    case 'farShot': return dist(me.pos, te.pos) >= 5 ? 2 : 1;
    default: return 1;
  }
}

export function damage(p: Party, t: number, src: string, dst: Unit, amount: number, ev: GEvent[]): void {
  const e = entOf(p, dst.id)!;
  if (!e.alive) return;
  if (dst.side === 'hero') {
    const guard = WEAPONS[dst.weapon!].guard;
    if (guard) amount = Math.max(1, Math.round(amount * guard));
    const soak = Math.min(dst.shield, amount);
    dst.shield -= soak; amount -= soak;
  }
  // a blow on a sleeping camp wakes the whole camp
  if (dst.asleep) for (const f of p.units) if (f.side === 'foe' && f.group === dst.group) f.asleep = false;
  // grit: a blow that would kill leaves one point, once in a while
  if (dst.side === 'hero' && amount >= e.hp && T.gritCd(dst) > 0 && t >= (dst.gritReady ?? 0)) {
    amount = e.hp - 1; dst.gritReady = t + T.gritCd(dst);
    ev.push({ t, type: 'buff', src: dst.id, dst: dst.id, text: 'grit' });
  }
  e.hp = Math.max(0, e.hp - amount);
  ev.push({ t, type: 'hit', src, dst: dst.id, amount, to: { ...e.pos } });
  if (e.hp <= 0) {
    e.alive = false;
    ev.push({ t, type: 'die', src, dst: dst.id, to: { ...e.pos } });
    const killer = unitOf(p, src);
    if (killer?.side === 'hero' && dst.side === 'foe') {
      credit(p, killer, e.pos);
      // mana flow: a kill takes seconds off the killer's skills
      const f = T.flow(killer);
      if (f) killer.ready = [killer.ready[0] - f, killer.ready[1] - f];
    }
    return;
  }
  if (dst.side === 'hero' && e.hp < e.maxHp * 0.3) guardian(p, dst, t, ev);
}

/** A cleric wards an ally who drops low (once in a while). */
function guardian(p: Party, ally: Unit, t: number, ev: GEvent[]): void {
  const cleric = p.units.find((x) => x.side === 'hero' && alive(p, x) && passive(x) === 'guardian' && t >= x.guardReady);
  if (!cleric) return;
  cleric.guardReady = t + 12;
  ally.shield = Math.min(30, ally.shield + 15);
  ev.push({ t, type: 'buff', src: cleric.id, dst: ally.id, text: 'ward' });
}

/** A kill made the way the hero's advanced class asks for counts toward it. */
function credit(p: Party, u: Unit, at: Cell): void {
  const promo = u.cls && PROMOTIONS[u.cls];
  if (!promo || u.promoteReady) return;
  const me = entOf(p, u.id)!;
  const counts = u.cls === 'warrior' ? me.hp < me.maxHp / 2 : u.cls === 'archer' ? dist(me.pos, at) >= 5 : false;
  // on the roaming maps the advanced class also waits for its level
  if (counts && ++u.progress >= promo.need && (!p.roam || (u.level ?? 1) >= PROMOTE_LEVEL)) u.promoteReady = true;
}

/** Is the target tucked beside cover on the shooter's side (a wall, a tree, a boulder…)? Point-blank ignores it. */
export function behindCover(p: Party, shooter: Cell, target: Cell): boolean {
  const dx = Math.sign(shooter.x - target.x), dy = Math.sign(shooter.y - target.y);
  const sides: Cell[] = [];
  if (dx) sides.push({ x: target.x + dx, y: target.y });
  if (dy) sides.push({ x: target.x, y: target.y + dy });
  if (dx && dy) sides.push({ x: target.x + dx, y: target.y + dy });
  const m = p.s.map;
  return dist(shooter, target) > 1 && sides.some((c) => opaque(tileAt(m, c)) || p.cover?.[idx(m, c)] === 1);
}

/** A basic attack (or a skill's blow at `mult`): engravings, then the weapon's own trait. */
export function strike(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[], mult = 1): void {
  const e = entOf(p, u.id)!, te = entOf(p, target.id)!, st = stats(u, t);
  const magic = u.cls ? CLASSES[u.cls].magic : false;
  if (st.range <= 1) ev.push({ t, type: 'bump', src: u.id, dst: target.id, from: { ...e.pos }, to: { ...te.pos } });
  else ev.push({ t, type: 'shoot', src: u.id, dst: target.id, from: { ...e.pos }, to: { ...te.pos }, text: magic ? 'spell' : 'bow' });
  // a shot at a body behind cover mostly hits the cover; eagle eyes aim truer, a sprinter's dodge and a shield's block turn some aside
  const covered = st.range > 1 && behindCover(p, e.pos, te.pos);
  const hit = (st.range <= 1 ? 0.9 : (covered ? 0.5 : 0.85) + T.hit(u)) * (1 - T.evade(target));
  const blocked = st.range <= 1 && p.s.rng.chance(T.block(target));
  if (blocked || !p.s.rng.chance(hit)) { ev.push({ t, type: 'miss', src: u.id, dst: target.id, to: { ...te.pos }, text: blocked ? 'block' : undefined }); return; }
  let m = mult;
  if (u.side === 'hero') {
    m *= passiveMult(p, u, target, t, ev) * u.empower;
    if (u.empower > 1) { u.empower = 1; u.hiddenUntil = 0; }
    // bond: each ally close by; steady aim: shots in a row from the same spot; a critical blow
    const near = p.units.filter((x) => x.side === 'hero' && x !== u && alive(p, x) && dist(posOf(p, x), e.pos) <= 2).length;
    m *= 1 + T.bond(u) * near;
    if (st.range > 1 && T.steadyMax(u)) {
      u.steady = u.steadyAt && u.steadyAt.x === e.pos.x && u.steadyAt.y === e.pos.y ? Math.min(T.steadyMax(u), (u.steady ?? 0) + 1) : 0;
      u.steadyAt = { ...e.pos };
      m *= 1 + 0.1 * u.steady;
    }
    if (T.crit(u) && p.s.rng.chance(T.crit(u))) m *= 1.5;
  }
  if (target.side === 'hero' && covered) m *= T.coverTaken(target);
  damage(p, t, u.id, target, Math.round(roll(p, st.dmg) * m), ev);
  const w = u.weapon ? WEAPONS[u.weapon] : undefined;
  if (w?.cleave || w?.splash) {
    const around = w.cleave ? e.pos : te.pos;
    for (const f of p.units) if (f.side !== u.side && f !== target && alive(p, f) && dist(posOf(p, f), around) === 1) damage(p, t, u.id, f, Math.round(roll(p, st.dmg) / 2), ev);
  }
  if (w?.stun && te.alive && p.s.rng.chance(w.stun)) target.nextAt = Math.max(target.nextAt, t + 1.2);
  // a warrior struck in melee sometimes strikes straight back
  if (u.side === 'foe' && st.range <= 1 && te.alive && passive(target) === 'counter' && p.s.rng.chance(T.counter(target))) strike(p, target, u, t + 0.1, ev);
}
