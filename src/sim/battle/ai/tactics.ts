
import type { TacticId } from '../../../data/types';
import { hasTag } from '../tags';
import type { Candidate } from './candidates';
import { foesOf, nearest } from './candidates';
import type { Consideration, Ctx } from './considerations';

type TacticScore = (c: Candidate, ctx: Ctx) => number;

const enemySkill = (c: Candidate): boolean => c.kind === 'skill' && c.skill?.target === 'enemy' && !!c.target;
const hpFrac = (c: Candidate): number => (c.target ? c.target.hp / c.target.maxHp : 1);

const RULES: Record<TacticId, { reason: string; score: TacticScore }> = {
  weakHunt: { reason: 'focusLow', score: (c) => (enemySkill(c) && !c.target!.downed ? (1 - hpFrac(c)) * 15 : 0) },
  casterHunt: {
    reason: 'focusCaster',
    score: (c) => (enemySkill(c) && ['caster', 'ranged', 'support'].includes(c.target!.setup.role) ? 25 : 0),
  },
  markHunt: { reason: 'focusMarked', score: (c) => (enemySkill(c) && hasTag(c.target!, 'marked') ? 25 : 0) },
  vanguard: {
    reason: 'vanguard',
    score: (c, { u, s }) => {
      if (!enemySkill(c)) return 0;
      const close = nearest(u, foesOf(u, s).filter((f) => !f.downed));
      return (close === c.target ? 10 : 0) + (c.skill!.hints?.includes('gapClose') ? 15 : 0);
    },
  },
  keepDistance: { reason: 'kite', score: (c) => (c.kind === 'kite' ? 30 : 0) },
  dangerFirst: { reason: 'dodge', score: (c) => (c.kind === 'dodge' ? 40 : 0) },
  rescueDowned: { reason: 'rescue', score: (c) => (c.kind === 'rescue' ? 40 : 0) },
  guardBack: {
    reason: 'protectBack',
    score: (c, { u, s }) => {
      if (c.kind === 'guard') return 30;
      if (!enemySkill(c)) return 0;
      const victim = s.units.find((a) => a.id === c.target!.intent?.targetId);
      return victim && victim.team === u.team && victim.line === 'back' ? 20 : 0;
    },
  },
  useCover: { reason: 'cover', score: (c, { s }) => (c.kind === 'kite' && s.obstacles.length ? 10 : 0) },
  followLeader: {
    reason: 'followLeader',
    score: (c, { u, s }) => {
      const leader = s.units.find((a) => a.team === u.team && a.setup.isLeader && a !== u);
      return enemySkill(c) && leader?.intent?.targetId === c.target!.id ? 30 : 0;
    },
  },
};

/** Tactic considerations apply only to units holding that tactic card. */
export const tacticConsiderations: Consideration[] = (Object.keys(RULES) as TacticId[]).map((id) => ({
  id: `tactic:${id}`,
  reason: RULES[id].reason,
  score: (c, ctx) => (ctx.u.setup.tactics.includes(id) ? RULES[id].score(c, ctx) : 0),
}));

