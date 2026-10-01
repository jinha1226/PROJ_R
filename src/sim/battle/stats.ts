import { TAGS } from '../../data/tags';
import type { Stats } from '../../data/types';
import { DODGE_CAP } from './constants';
import type { BattleState, UnitState } from './types';

/** Multiplicative stat multipliers. */
export type StatMods = Partial<Record<keyof Stats, number>>;
export type StatModifier = (u: UnitState, s: BattleState) => StatMods | null;
/** Multiplicative outgoing-damage multiplier. */
export type DamageModifier = (src: UnitState, dst: UnitState, s: BattleState) => number;

const tagMove: StatModifier = (u) => {
  let m = 1;
  for (const t of u.tags) m *= TAGS[t.tag].moveMult;
  return m === 1 ? null : { moveSpeed: m };
};

const bossPhase: StatModifier = (u) => {
  if (!u.phaseIndex || !u.setup.phases) return null;
  const mods: StatMods = {};
  for (const p of u.setup.phases.slice(0, u.phaseIndex))
    for (const [k, val] of Object.entries(p.statMult) as [keyof Stats, number][]) mods[k] = (mods[k] ?? 1) * val;
  return mods;
};

/** Multiplicative momentum-gain multiplier. */
export type MomentumModifier = (u: UnitState, s: BattleState) => number;
/** Return true to keep a unit at 1 HP instead of going down/dying (consumes nothing by itself). */
export type LethalGuard = (u: UnitState, s: BattleState) => boolean;

export const statModifiers: StatModifier[] = [tagMove, bossPhase];
export const momentumModifiers: MomentumModifier[] = [];
export const lethalGuards: LethalGuard[] = [];
/** Multiplicative healing multiplier (healer, receiver). */
export type HealModifier = (src: UnitState, dst: UnitState, s: BattleState) => number;
export const healModifiers: HealModifier[] = [];
/** Multiplicative multiplier on the lifeline a unit gets when downed. */
export type LifelineModifier = (u: UnitState, s: BattleState) => number;
export const lifelineModifiers: LifelineModifier[] = [];

export function registerHealModifier(m: HealModifier): void {
  healModifiers.push(m);
}

export function registerLifelineModifier(m: LifelineModifier): void {
  lifelineModifiers.push(m);
}

export function registerMomentumModifier(m: MomentumModifier): void {
  momentumModifiers.push(m);
}

export function registerLethalGuard(g: LethalGuard): void {
  lethalGuards.push(g);
}
export const damageModifiers: DamageModifier[] = [(_src, _dst, s) => s.berserkMult];

export function registerStatModifier(m: StatModifier): void {
  statModifiers.push(m);
}

export function registerDamageModifier(m: DamageModifier): void {
  damageModifiers.push(m);
}

export function effectiveStats(u: UnitState, s: BattleState): Stats {
  const out = { ...u.setup.stats, maxHp: u.maxHp };
  for (const mod of statModifiers) {
    const mods = mod(u, s);
    if (!mods) continue;
    for (const [k, val] of Object.entries(mods) as [keyof Stats, number][]) out[k] *= val;
  }
  out.dodge = Math.min(DODGE_CAP, out.dodge);
  return out;
}

export function damageMultiplier(src: UnitState, dst: UnitState, s: BattleState): number {
  let m = 1;
  for (const mod of damageModifiers) m *= mod(src, dst, s);
  return m;
}
