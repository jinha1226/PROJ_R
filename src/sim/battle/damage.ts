import { CRIT_MULT, LIFELINE_PCT, MOMENTUM_MAX } from './constants';
import { emit } from './events';
import { damageMultiplier, effectiveStats, healModifiers, lethalGuards, lifelineModifiers, momentumModifiers } from './stats';
import type { BattleState, UnitState } from './types';

export interface HitOpts {
  mult: number;
  canDodge: boolean;
  canCrit: boolean;
  skillId: string;
  reason?: string;
}

export function computeDamage(atk: number, mult: number, def: number, crit: boolean, otherMult: number): number {
  return Math.max(1, Math.round(atk * mult * (100 / (100 + def)) * (crit ? CRIT_MULT : 1) * otherMult));
}

export function gainMomentum(s: BattleState, u: UnitState, amount: number): void {
  if (!u.alive || u.downed) return;
  let m = 1;
  for (const mod of momentumModifiers) m *= mod(u, s);
  u.momentum = Math.min(MOMENTUM_MAX, u.momentum + amount * m);
}

export function killUnit(s: BattleState, u: UnitState, by: UnitState | null): void {
  if (!u.alive) return;
  u.alive = false;
  u.downed = false;
  u.action = null;
  u.forced = null;
  u.vel = { x: 0, y: 0 };
  s.telegraphs = s.telegraphs.filter((t) => t.srcId !== u.id);
  if (by) by.stats.kills++;
  emit(s, { type: 'died', src: by?.id, dst: u.id });
}

export function downUnit(s: BattleState, u: UnitState, by: UnitState | null): void {
  u.downed = true;
  u.hp = 0;
  u.lifeline = u.maxHp * LIFELINE_PCT * lifelineModifiers.reduce((m, f) => m * f(u, s), 1);
  u.action = null;
  u.forced = null;
  u.vel = { x: 0, y: 0 };
  u.momentum = 0;
  u.engagedWith = null;
  u.rescueTarget = null;
  u.tags = u.tags.filter((t) => t.tag === 'shield');
  s.telegraphs = s.telegraphs.filter((t) => t.srcId !== u.id);
  emit(s, { type: 'downed', src: by?.id, dst: u.id });
}

/** Returns damage actually dealt (0 on a dodge). */
export function dealDamage(s: BattleState, src: UnitState, dst: UnitState, opts: HitOpts): number {
  if (!dst.alive) return 0;
  const se = effectiveStats(src, s);
  const de = effectiveStats(dst, s);
  if (opts.canDodge && !dst.downed && s.rng.chance(de.dodge)) {
    dst.stats.dodges++;
    emit(s, { type: 'miss', src: src.id, dst: dst.id, skillId: opts.skillId });
    return 0;
  }
  const crit = opts.canCrit && s.rng.chance(se.crit);
  const amount = computeDamage(se.atk, opts.mult, de.def, crit, damageMultiplier(src, dst, s));
  let rest = amount;
  if (dst.shield > 0) {
    const absorbed = Math.min(dst.shield, rest);
    dst.shield -= absorbed;
    rest -= absorbed;
  }
  gainMomentum(s, src, (amount / dst.maxHp) * 40);
  gainMomentum(s, dst, (amount / dst.maxHp) * 60);
  dst.threat[src.id] = (dst.threat[src.id] ?? 0) + amount;
  src.stats.damageDealt += amount;
  emit(s, { type: 'damage', src: src.id, dst: dst.id, amount, crit, skillId: opts.skillId, reason: opts.reason });
  if (dst.downed) {
    dst.lifeline -= rest;
    if (dst.lifeline <= 0) killUnit(s, dst, src);
    return amount;
  }
  dst.hp -= rest;
  if (dst.hp <= 0 && lethalGuards.some((g) => g(dst, s))) dst.hp = 1;
  if (dst.hp <= 0) {
    if (dst.team === 'ally') downUnit(s, dst, src);
    else killUnit(s, dst, src);
  }
  return amount;
}

export function heal(s: BattleState, src: UnitState, dst: UnitState, amount: number, skillId: string): number {
  if (!dst.alive || dst.downed) return 0;
  const boosted = amount * healModifiers.reduce((m, f) => m * f(src, dst, s), 1);
  const healed = Math.min(Math.round(boosted), dst.maxHp - dst.hp);
  if (healed <= 0) return 0;
  dst.hp += healed;
  src.stats.healingDone += healed;
  emit(s, { type: 'heal', src: src.id, dst: dst.id, amount: healed, skillId });
  return healed;
}
