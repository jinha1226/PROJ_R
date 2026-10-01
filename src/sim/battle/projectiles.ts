import { add, dist, norm, scale, sub } from '../../core/vec2';
import { getSkill } from '../../data/skills';
import type { SkillDef } from '../../data/types';
import { DT } from './constants';
import { inArea } from './areas';
import { applyToTargets, collectTargets } from './effects';
import { emit } from './events';
import type { BattleState, Projectile, UnitState } from './types';

const HIT_DIST = 0.3;

export function spawnProjectile(s: BattleState, caster: UnitState, skill: SkillDef, target: UnitState): void {
  if (!skill.projectile) return;
  const p: Projectile = {
    id: s.nextId++, srcId: caster.id, skillId: skill.id, targetId: target.id,
    pos: { ...caster.pos }, speed: skill.projectile.speed, visual: skill.projectile.visual,
  };
  s.projectiles.push(p);
  emit(s, { type: 'projectile', src: caster.id, dst: target.id, skillId: skill.id, data: { id: p.id, visual: p.visual } });
}

export function updateProjectiles(s: BattleState): void {
  const keep: Projectile[] = [];
  for (const p of [...s.projectiles]) {
    const target = s.units.find((u) => u.id === p.targetId);
    const caster = s.units.find((u) => u.id === p.srcId);
    if (!target || !target.alive || !caster) {
      emit(s, { type: 'projectile_fizzle', data: { id: p.id } });
      continue;
    }
    const d = dist(p.pos, target.pos);
    const step = p.speed * DT;
    if (d - step > HIT_DIST) {
      p.pos = add(p.pos, scale(norm(sub(target.pos, p.pos)), step));
      keep.push(p);
      continue;
    }
    p.pos = { ...target.pos };
    const skill = getSkill(p.skillId);
    const area = skill.area;
    const targets = area
      ? collectTargets(s, caster, skill, (q) => inArea(area, target.pos, sub(target.pos, caster.pos), q, 1))
      : [target];
    emit(s, { type: 'projectile_hit', src: caster.id, dst: target.id, skillId: skill.id, pos: p.pos, data: { id: p.id } });
    applyToTargets(s, caster, skill, targets);
  }
  s.projectiles = keep;
}
