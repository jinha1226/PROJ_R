import { angleOf, sub, type Vec2 } from '../../core/vec2';
import { getSkill } from '../../data/skills';
import type { SkillDef } from '../../data/types';
import { MOMENTUM_MAX, TICK_RATE, secToTicks } from './constants';
import { fireSkill } from './effects';
import { emit } from './events';
import { effectiveStats } from './stats';
import { isActionBlocked } from './tags';
import { createTelegraph } from './telegraphs';
import { skillCooldownMult } from './skillLevel';
import type { ActionState, BattleState, UnitState } from './types';

export function isReady(u: UnitState, skillId: string): boolean {
  if ((u.cooldowns[skillId] ?? 0) > 0) return false;
  return getSkill(skillId).kind !== 'ultimate' || u.momentum >= MOMENTUM_MAX;
}

export function tickCooldowns(s: BattleState): void {
  for (const u of s.units) for (const k of Object.keys(u.cooldowns)) u.cooldowns[k] = Math.max(0, u.cooldowns[k]! - 1);
}

const phaseTicks = (u: UnitState, skill: SkillDef, phase: ActionState['phase'], s: BattleState): number => {
  const sec = phase === 'windup' ? skill.windup : phase === 'active' ? skill.active : skill.recovery;
  return secToTicks((skill.kind === 'basic' ? sec / effectiveStats(u, s).atkSpeed : sec) / s.tempo);
};

const findUnit = (s: BattleState, id?: string): UnitState | undefined => (id ? s.units.find((u) => u.id === id) : undefined);

export function startAction(s: BattleState, u: UnitState, skillId: string, targetId?: string, targetPos?: Vec2): void {
  const skill = getSkill(skillId);
  const ticks = phaseTicks(u, skill, 'windup', s);
  u.action = { skillId, targetId, targetPos, phase: 'windup', ticksLeft: ticks, totalTicks: ticks };
  u.vel = { x: 0, y: 0 };
  const target = findUnit(s, targetId);
  if (skill.telegraph) u.action.telegraphId = createTelegraph(s, u, skill, target, targetPos);
  const aim = target?.pos ?? targetPos;
  if (aim && (aim.x !== u.pos.x || aim.y !== u.pos.y)) u.facing = angleOf(sub(aim, u.pos));
  emit(s, { type: 'action_start', src: u.id, dst: targetId, skillId });
}

function targetInvalid(u: UnitState, skill: SkillDef, target: UnitState | undefined): boolean {
  if (skill.target === 'self' || skill.telegraph) return false;
  if (!target || !target.alive) return true;
  return skill.target === 'ally' && target.downed;
}

function enterPhase(s: BattleState, u: UnitState, a: ActionState, skill: SkillDef, phase: ActionState['phase']): void {
  a.phase = phase;
  a.ticksLeft = phaseTicks(u, skill, phase, s);
  a.totalTicks = a.ticksLeft;
}

export function advanceActions(s: BattleState): void {
  for (const u of s.units) {
    const a = u.action;
    if (!a) continue;
    if (!u.alive || u.downed || isActionBlocked(u)) {
      if (a.telegraphId !== undefined && a.phase === 'windup') s.telegraphs = s.telegraphs.filter((t) => t.id !== a.telegraphId);
      u.action = null;
      emit(s, { type: 'action_cancel', src: u.id, skillId: a.skillId });
      continue;
    }
    a.ticksLeft--;
    if (a.ticksLeft > 0) continue;
    const skill = getSkill(a.skillId);
    if (a.phase === 'windup') {
      const target = findUnit(s, a.targetId);
      if (targetInvalid(u, skill, target)) {
        u.action = null;
        u.decisionIn = 0;
        emit(s, { type: 'action_cancel', src: u.id, skillId: a.skillId });
        continue;
      }
      fireSkill(s, u, skill, target, a.targetPos);
      if (skill.cooldown > 0) u.cooldowns[skill.id] = Math.round((skill.cooldown * TICK_RATE * skillCooldownMult(u.setup, skill.id)) / s.tempo);
      if (skill.kind === 'ultimate') u.momentum = 0;
      emit(s, { type: 'action_fire', src: u.id, dst: a.targetId, skillId: skill.id });
      enterPhase(s, u, a, skill, 'active');
    } else if (a.phase === 'active') {
      enterPhase(s, u, a, skill, 'recovery');
    } else {
      u.action = null;
      u.decisionIn = 0;
    }
  }
}
