import { dist, dot, norm, sub, type Vec2 } from '../../core/vec2';
import type { AreaShape } from '../../data/types';
import { UNIT_RADIUS } from './constants';
import type { UnitState } from './types';

/** Point-in-area test, lenient by one unit radius. */
export function inArea(area: AreaShape, origin: Vec2, dir: Vec2, p: Vec2, mult: number): boolean {
  const d = dist(origin, p);
  if (area.shape === 'circle') return d <= area.radius * mult + UNIT_RADIUS;
  if (area.shape === 'cone') {
    if (d > area.radius * mult + UNIT_RADIUS) return false;
    if (d <= UNIT_RADIUS) return true;
    const cos = dot(norm(dir), norm(sub(p, origin)));
    return Math.acos(Math.max(-1, Math.min(1, cos))) <= ((area.angleDeg / 2) * Math.PI) / 180;
  }
  const n = norm(dir);
  const rel = sub(p, origin);
  const along = dot(rel, n);
  const across = Math.abs(rel.x * n.y - rel.y * n.x);
  return along >= -UNIT_RADIUS && along <= area.length * mult + UNIT_RADIUS && across <= (area.width * mult) / 2 + UNIT_RADIUS;
}

export function areaOrigin(area: AreaShape, caster: UnitState, target: UnitState | undefined, targetPos: Vec2 | undefined): Vec2 {
  if (area.shape === 'circle' && area.center === 'target') return { ...(target?.pos ?? targetPos ?? caster.pos) };
  return { ...caster.pos };
}
