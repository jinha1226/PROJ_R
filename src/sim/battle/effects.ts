import { add, dist, fromAngle, norm, scale, sub, type Vec2 } from '../../core/vec2';
import { ENEMIES } from '../../data/enemies';
import { TAGS } from '../../data/tags';
import type { Effect, SkillDef } from '../../data/types';
import { DT, STAGE_SCALE } from './constants';
import { areaOrigin, inArea } from './areas';
import { dealDamage, heal } from './damage';
import { emit } from './events';
import { spawnProjectile } from './projectiles';
import { enemyFromDef, makeUnitState } from './setup';
import { effectiveStats } from './stats';
import { addTag, hasTag, removeTag } from './tags';
import { skillPowerMult } from './skillLevel';
import type { BattleState, UnitState } from './types';

const FORCED_TICKS = 4;

/** Units the skill may affect, filtered by an area predicate. Sorted by id. */
export function collectTargets(s: BattleState, caster: UnitState, skill: SkillDef, inside: (p: Vec2) => boolean): UnitState[] {
  if (skill.target === 'self') return [caster];
  return s.units
    .filter((u) => u.alive && inside(u.pos))
    .filter((u) => (skill.target === 'enemy' ? u.team !== caster.team : u.team === caster.team && !u.downed))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function forcedToward(from: Vec2, to: Vec2, distance: number, fallbackAngle: number): Vec2 {
  const d = sub(to, from);
  const dir = d.x === 0 && d.y === 0 ? fromAngle(fallbackAngle) : norm(d);
  return scale(dir, distance / (FORCED_TICKS * DT));
}

function summon(s: BattleState, caster: UnitState, enemyId: string, count: number): void {
  const base = ENEMIES[caster.setup.defId]?.base.maxHp ?? caster.maxHp;
  const stage = Math.max(1, Math.round(1 + (caster.maxHp / base - 1) / STAGE_SCALE));
  for (let i = 0; i < count; i++) {
    const setup = enemyFromDef(enemyId, 2, 0, stage, 0);
    setup.id = `s${s.nextId++}`;
    const pos = add(caster.pos, scale(fromAngle(caster.facing + (Math.PI * 2 * i) / count), 1.6));
    const u = makeUnitState(setup, pos, 0, true);
    u.decisionIn = 15;
    s.units.push(u);
    emit(s, { type: 'summon', src: caster.id, dst: u.id, pos });
  }
}

export function applyEffect(s: BattleState, caster: UnitState, dst: UnitState, ef: Effect, skill: SkillDef): void {
  switch (ef.type) {
    case 'damage':
      dealDamage(s, caster, dst, { mult: ef.mult * skillPowerMult(caster.setup, skill.id), canDodge: !skill.area && !skill.telegraph, canCrit: true, skillId: skill.id });
      break;
    case 'heal':
      heal(s, caster, dst, ef.mult * skillPowerMult(caster.setup, skill.id) * effectiveStats(caster, s).atk, skill.id);
      break;
    case 'addTag':
      addTag(s, dst, ef.tag, ef.duration, ef.value ?? 0, caster.id);
      break;
    case 'knockback':
      if (dst.alive && !dst.downed && !dst.setup.boss)
        dst.forced = { vel: forcedToward(caster.pos, dst.pos, ef.distance, caster.facing), ticksLeft: FORCED_TICKS, kind: 'knockback' };
      break;
    case 'dash': {
      const self = dst === caster;
      const travel = self ? ef.distance : Math.min(ef.distance, Math.max(0, dist(caster.pos, dst.pos) - (ef.stopShort ?? 1)));
      if (travel > 0.05) {
        const to = self ? add(caster.pos, fromAngle(caster.facing)) : dst.pos;
        caster.forced = { vel: forcedToward(caster.pos, to, travel, caster.facing), ticksLeft: FORCED_TICKS, kind: 'dash' };
      }
      break;
    }
    case 'shield':
      dst.shield += ef.pctMaxHp * dst.maxHp;
      addTag(s, dst, 'shield', ef.duration, 0, caster.id);
      break;
    case 'taunt':
      dst.threat[caster.id] = 1e6;
      addTag(s, dst, 'taunted', ef.duration, 0, caster.id);
      break;
    case 'cleanse':
      for (const t of [...dst.tags]) if (TAGS[t.tag].negative) removeTag(s, dst, t.tag);
      break;
    case 'summon':
      summon(s, caster, ef.enemyId, ef.count);
      break;
  }
}

export function applyToTargets(s: BattleState, caster: UnitState, skill: SkillDef, targets: UnitState[]): void {
  for (const ef of skill.selfEffects ?? []) applyEffect(s, caster, caster, ef, skill);
  for (const dst of targets) {
    for (const r of skill.reacts ?? []) {
      if (!dst.alive || !hasTag(dst, r.tag)) continue;
      if (r.consume) removeTag(s, dst, r.tag);
      emit(s, { type: 'combo', src: caster.id, dst: dst.id, skillId: skill.id, tag: r.tag });
      for (const ef of r.effects) applyEffect(s, caster, dst, ef, skill);
    }
    for (const ef of skill.effects) if (dst.alive || ef.type === 'summon') applyEffect(s, caster, dst, ef, skill);
  }
}

/** Called when an action leaves windup. Telegraph skills resolve in telegraphs.ts instead. */
export function fireSkill(s: BattleState, caster: UnitState, skill: SkillDef, target: UnitState | undefined, targetPos: Vec2 | undefined): void {
  if (skill.telegraph) return;
  if (skill.projectile && target) {
    spawnProjectile(s, caster, skill, target);
    return;
  }
  if (skill.area) {
    const area = skill.area;
    const origin = areaOrigin(area, caster, target, targetPos);
    const aim = target?.pos ?? targetPos;
    const dir = aim ? sub(aim, caster.pos) : fromAngle(caster.facing);
    applyToTargets(s, caster, skill, collectTargets(s, caster, skill, (p) => inArea(area, origin, dir, p, 1)));
    return;
  }
  applyToTargets(s, caster, skill, skill.target === 'self' ? [caster] : target ? [target] : []);
}
