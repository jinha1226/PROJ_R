import type { UnitSnap } from '../../sim/battle/types';

export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function interpUnit(prev: UnitSnap | undefined, curr: UnitSnap, t: number): { x: number; y: number; facing: number } {
  if (!prev) return { x: curr.x, y: curr.y, facing: curr.facing };
  return {
    x: prev.x + (curr.x - prev.x) * t,
    y: prev.y + (curr.y - prev.y) * t,
    facing: lerpAngle(prev.facing, curr.facing, t),
  };
}
