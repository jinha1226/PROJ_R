import { dist } from '../../core/vec2';
import { COMBOS, GENERIC_COMBO } from '../../data/combos';
import { getSkill } from '../../data/skills';
import type { ComboDef } from '../../data/types';
import { startAction } from '../battle/actions';
import { candidateExecutors, registerCandidateGenerator, type Candidate } from '../battle/ai/candidates';
import { registerConsideration, unitsInSkillArea } from '../battle/ai/considerations';
import { DECISION_INTERVAL, TICK_RATE } from '../battle/constants';
import { emit } from '../battle/events';
import { isActionBlocked } from '../battle/tags';
import type { BattleState, UnitState } from '../battle/types';
import { pairKey, partners } from './relations';

const MAX_PAIR_DIST = 6;
const MOMENTUM_COST = 50;

export function comboFor(a: UnitState, b: UnitState): { def: ComboDef; lead: UnitState; partner: UnitState } {
  const ca = a.setup.defId;
  const cb = b.setup.defId;
  const def = COMBOS.find((c) => (c.classes[0] === ca && c.classes[1] === cb) || (c.classes[0] === cb && c.classes[1] === ca));
  if (!def) {
    const [lead, partner] = a.id < b.id ? [a, b] : [b, a];
    return { def: GENERIC_COMBO, lead, partner };
  }
  return def.lead === ca ? { def, lead: a, partner: b } : { def, lead: b, partner: a };
}

const free = (u: UnitState): boolean => u.alive && !u.downed && !u.forced && !isActionBlocked(u);

registerCandidateGenerator((u, s) => {
  if (u.team !== 'ally' || s.relations.size === 0 || u.momentum < MOMENTUM_COST) return [];
  const out: Candidate[] = [];
  for (const p of partners(s, u, 'comrade')) {
    const { def, lead, partner } = comboFor(u, p);
    if (lead !== u || !free(partner) || dist(u.pos, partner.pos) > MAX_PAIR_DIST) continue;
    if ((s.pairCooldowns.get(pairKey(u.id, p.id)) ?? -1) > s.tick) continue;
    const skill = getSkill(def.skill);
    const targets = skill.target === 'enemy'
      ? s.units.filter((f) => f.team !== u.team && f.alive && !f.downed && dist(u.pos, f.pos) <= skill.range + 0.2)
      : [u];
    for (const target of targets) out.push({ kind: 'pairCombo', skillId: def.skill, skill, target, ally: partner, inRange: true });
  }
  return out;
});

registerConsideration({ id: 'pairCombo', reason: 'comboPair', score: (c, ctx) => {
  if (c.kind !== 'pairCombo') return 0;
  const crowd = c.skill?.area && c.skill.target === 'enemy' ? unitsInSkillArea(c, ctx, 'foe').length * 8 : 0;
  return 70 + crowd;
} });

candidateExecutors.pairCombo = (s: BattleState, lead: UnitState, c: Candidate) => {
  const partner = c.ally;
  if (!partner || !c.skillId) return;
  const { def } = comboFor(lead, partner);
  const target = c.target;
  startAction(s, lead, def.skill, target?.id, target ? { ...target.pos } : undefined);
  if (partner.action?.telegraphId !== undefined && partner.action.phase === 'windup')
    s.telegraphs = s.telegraphs.filter((t) => t.id !== partner.action!.telegraphId);
  partner.action = null;
  const ps = getSkill(def.partnerSkill);
  const pTarget = ps.target === 'enemy' ? target : ps.target === 'ally' ? lead : partner;
  startAction(s, partner, def.partnerSkill, pTarget?.id, pTarget ? { ...pTarget.pos } : undefined);
  partner.intent = { kind: 'skill', skillId: def.partnerSkill, targetId: pTarget?.id, reason: 'comboPair', detail: ['comboPair'] };
  partner.decisionIn = DECISION_INTERVAL;
  lead.momentum = Math.max(0, lead.momentum - MOMENTUM_COST);
  partner.momentum = Math.max(0, partner.momentum - MOMENTUM_COST);
  s.pairCooldowns.set(pairKey(lead.id, partner.id), s.tick + def.cooldown * TICK_RATE);
  emit(s, { type: 'pair_combo', src: lead.id, dst: partner.id, skillId: def.id });
};
