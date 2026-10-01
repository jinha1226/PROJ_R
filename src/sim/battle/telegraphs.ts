import { fromAngle, norm, sub, type Vec2 } from '../../core/vec2';
import { getSkill } from '../../data/skills';
import type { SkillDef } from '../../data/types';
import { secToTicks } from './constants';
import { areaOrigin, inArea } from './areas';
import { applyToTargets, collectTargets } from './effects';
import { emit } from './events';
import type { BattleState, Telegraph, UnitState } from './types';

const phaseAreaMult = (u: UnitState): number =>
  (u.setup.phases ?? []).slice(0, u.phaseIndex).reduce((m, p) => m * p.areaMult, 1);

export function createTelegraph(
  s: BattleState, caster: UnitState, skill: SkillDef, target: UnitState | undefined, targetPos: Vec2 | undefined,
): number {
  if (!skill.area) throw new Error(`telegraph skill without area: ${skill.id}`);
  const aim = target?.pos ?? targetPos;
  const dir = aim && (aim.x !== caster.pos.x || aim.y !== caster.pos.y) ? norm(sub(aim, caster.pos)) : fromAngle(caster.facing);
  const tel: Telegraph = {
    id: s.nextId++, srcId: caster.id, skillId: skill.id, team: caster.team, area: skill.area,
    origin: areaOrigin(skill.area, caster, target, targetPos), dir,
    // fires on the same tick the caster's windup completes (advanceActions runs before updateTelegraphs); a sortie's tempo shortens both
    startedAt: s.tick, firesAt: s.tick + secToTicks(skill.windup / s.tempo) - 1, areaMult: phaseAreaMult(caster),
  };
  s.telegraphs.push(tel);
  emit(s, { type: 'telegraph_start', src: caster.id, skillId: skill.id, pos: tel.origin, data: { id: tel.id } });
  return tel.id;
}

export function updateTelegraphs(s: BattleState): void {
  const keep: Telegraph[] = [];
  for (const t of s.telegraphs) {
    const caster = s.units.find((u) => u.id === t.srcId);
    if (!caster || !caster.alive || caster.downed) continue;
    if (s.tick < t.firesAt) {
      keep.push(t);
      continue;
    }
    const skill = getSkill(t.skillId);
    const targets = collectTargets(s, caster, skill, (p) => inArea(t.area, t.origin, t.dir, p, t.areaMult));
    emit(s, { type: 'telegraph_fire', src: caster.id, skillId: t.skillId, pos: t.origin, data: { id: t.id } });
    applyToTargets(s, caster, skill, targets);
  }
  s.telegraphs = keep;
}

/** The soonest enemy telegraph that currently covers u. */
export function telegraphThreatFor(u: UnitState, s: BattleState): { tel: Telegraph; ticksLeft: number } | null {
  let best: { tel: Telegraph; ticksLeft: number } | null = null;
  for (const t of s.telegraphs) {
    if (t.team === u.team || !inArea(t.area, t.origin, t.dir, u.pos, t.areaMult)) continue;
    const left = t.firesAt - s.tick;
    if (!best || left < best.ticksLeft) best = { tel: t, ticksLeft: left };
  }
  return best;
}
