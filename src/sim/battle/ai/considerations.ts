import { dist, sub } from '../../../core/vec2';
import type { Stats } from '../../../data/types';
import { areaOrigin, inArea } from '../areas';
import { hasTag } from '../tags';
import { telegraphThreatFor } from '../telegraphs';
import type { BattleState, UnitState } from '../types';
import type { Candidate } from './candidates';

export interface Ctx {
  u: UnitState;
  s: BattleState;
  eff: Stats;
  /** cached: is u currently inside an enemy telegraph */
  inDanger: boolean;
}

export interface Consideration {
  id: string;
  score(c: Candidate, ctx: Ctx): number;
  /** ko.reason key credited when this consideration contributes the most */
  reason?: string;
}

const hpFrac = (u: UnitState): number => (u.maxHp > 0 ? u.hp / u.maxHp : 0);
const isEnemySkill = (c: Candidate): boolean => c.kind === 'skill' && c.skill?.target === 'enemy';

/** Units of the given relation inside the area the candidate's skill would cover. */
export function unitsInSkillArea(c: Candidate, ctx: Ctx, side: 'foe' | 'friend'): UnitState[] {
  const area = c.skill?.area;
  if (!area) return [];
  const origin = areaOrigin(area, ctx.u, c.target, undefined);
  const dir = c.target ? sub(c.target.pos, ctx.u.pos) : { x: Math.cos(ctx.u.facing), y: Math.sin(ctx.u.facing) };
  return ctx.s.units.filter(
    (o) =>
      o.alive &&
      (side === 'foe' ? o.team !== ctx.u.team && !o.downed : o.team === ctx.u.team && !o.downed) &&
      inArea(area, origin, dir, o.pos, 1),
  );
}

const BASE: Record<string, number> = { kite: 25, rescue: 30, guard: 15, idle: 1, dodge: 0 };

export const considerations: Consideration[] = [
  {
    id: 'baseValue',
    score: (c) => {
      if (c.kind !== 'skill') return BASE[c.kind] ?? 0;
      return c.inRange ? c.skill!.aiValue : c.skill!.aiValue * 0.6;
    },
  },
  {
    id: 'distance',
    score: (c, { u }) =>
      c.kind === 'skill' && c.target && !c.inRange ? -1.5 * Math.max(0, dist(u.pos, c.target.pos) - c.skill!.range) : 0,
  },
  {
    id: 'lowHp', reason: 'focusLow',
    score: (c) => (isEnemySkill(c) && c.target && !c.target.downed ? (1 - hpFrac(c.target)) * 15 : 0),
  },
  {
    id: 'downedTarget',
    score: (c) => (isEnemySkill(c) && c.target?.downed ? -40 : 0),
  },
  {
    id: 'healNeed', reason: 'heal',
    score: (c, ctx) => {
      if (c.kind !== 'skill' || !c.skill!.hints?.includes('heal') || !c.target) return 0;
      const f = hpFrac(c.target);
      const base = f > 0.85 ? -100 : (1 - f) * 60;
      const extra = c.skill!.area ? unitsInSkillArea(c, ctx, 'friend').filter((o) => hpFrac(o) < 0.85).length * 10 : 0;
      return base + extra;
    },
  },
  {
    id: 'aoeCount',
    score: (c, ctx) => {
      if (c.kind !== 'skill' || !c.skill!.hints?.includes('aoe') || c.skill!.target !== 'enemy') return 0;
      const n = unitsInSkillArea(c, ctx, 'foe').length;
      return n === 0 ? -100 : (n - 1) * 12;
    },
  },
  {
    id: 'tagReaction', reason: 'combo',
    score: (c) => (c.kind === 'skill' && c.target && c.skill!.reacts?.some((r) => hasTag(c.target!, r.tag)) ? 30 : 0),
  },
  {
    id: 'tagRedundancy',
    score: (c) =>
      c.kind === 'skill' && c.target && c.skill!.effects.some((e) => e.type === 'addTag' && hasTag(c.target!, e.tag)) ? -15 : 0,
  },
  {
    id: 'stickiness',
    score: (c, { u }) => (c.target && u.intent?.targetId === c.target.id && c.kind === 'skill' ? 8 : 0),
  },
  {
    id: 'engagedSwitch',
    score: (c, { u }) => (isEnemySkill(c) && u.engagedWith && c.target && c.target.id !== u.engagedWith ? -10 : 0),
  },
  {
    id: 'danger', reason: 'dodge',
    score: (c, ctx) => (c.kind === 'dodge' ? 80 : ctx.inDanger ? -40 : 0),
  },
  {
    id: 'threat', reason: 'threat',
    score: (c, { u }) =>
      u.team === 'enemy' && isEnemySkill(c) && c.target ? Math.min(30, ((u.threat[c.target.id] ?? 0) / u.maxHp) * 50) : 0,
  },
  {
    id: 'shieldNeed',
    score: (c, ctx) => {
      if (c.kind !== 'skill' || !c.skill!.hints?.includes('shield')) return 0;
      const group = c.skill!.area ? unitsInSkillArea(c, ctx, 'friend') : c.target ? [c.target] : [];
      if (group.length === 0) return -50;
      const avg = group.reduce((a, o) => a + hpFrac(o), 0) / group.length;
      return avg < 0.7 ? 25 : -20;
    },
  },
  {
    id: 'rescueValue', reason: 'rescue',
    score: (c, { s }) => {
      if (c.kind !== 'rescue' || !c.target) return 0;
      const near = s.units.filter((o) => o.alive && o.team !== c.target!.team && dist(o.pos, c.target!.pos) <= 3).length;
      return -8 * near + (c.target.setup.isLeader ? 15 : 0);
    },
  },
  {
    id: 'ultimateGate',
    score: (c, { u, s }) => {
      if (c.kind !== 'skill' || c.skill!.kind !== 'ultimate') return 0;
      const foes = s.units.filter((o) => o.alive && !o.downed && o.team !== u.team).length;
      return foes >= 2 || c.target?.setup.boss ? 10 : 0;
    },
  },
];

export function registerConsideration(c: Consideration): void {
  considerations.push(c);
}

export function makeCtx(u: UnitState, s: BattleState, eff: Stats): Ctx {
  return { u, s, eff, inDanger: telegraphThreatFor(u, s) !== null };
}
