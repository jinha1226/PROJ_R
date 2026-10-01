import { add, clampLen, dist, len, norm, scale, sub, v, angleOf, type Vec2 } from '../../core/vec2';
import { DT, SEPARATION_RADIUS, UNIT_RADIUS } from './constants';
import { clampToBounds, pushOutOfObstacle } from './geometry';
import { effectiveStats } from './stats';
import { isActionBlocked } from './tags';
import type { BattleState, UnitState } from './types';

/** Sets u.vel (m/s) toward dest, zero once within stopDist. */
export function steerToward(u: UnitState, dest: Vec2, s: BattleState, stopDist: number): void {
  const d = sub(dest, u.pos);
  if (len(d) <= stopDist) {
    u.vel = v(0, 0);
    return;
  }
  u.vel = scale(norm(d), effectiveStats(u, s).moveSpeed);
}

export function steerAway(u: UnitState, from: Vec2, s: BattleState): void {
  const d = sub(u.pos, from);
  u.vel = scale(len(d) === 0 ? v(-1, 0) : norm(d), effectiveStats(u, s).moveSpeed);
}

/** Living units within r of center, sorted by id for determinism. */
export function unitsInRadius(s: BattleState, center: Vec2, r: number, pred?: (u: UnitState) => boolean): UnitState[] {
  return s.units
    .filter((u) => u.alive && !u.dormant && dist(u.pos, center) <= r && (!pred || pred(u)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function separation(u: UnitState, s: BattleState, speed: number): Vec2 {
  let push = v(0, 0);
  for (const o of s.units) {
    if (o === u || !o.alive || o.dormant) continue;
    const d = dist(u.pos, o.pos);
    if (d >= SEPARATION_RADIUS) continue;
    const dir = d === 0 ? (u.id < o.id ? v(-1, 0) : v(1, 0)) : norm(sub(u.pos, o.pos));
    push = add(push, scale(dir, ((SEPARATION_RADIUS - d) / SEPARATION_RADIUS) * speed));
  }
  return push;
}

const MAX_HOP = 0.3;

function resolveObstacles(u: UnitState, s: BattleState): void {
  for (const o of s.obstacles) u.pos = pushOutOfObstacle(u.pos, UNIT_RADIUS, o);
}

export function moveUnits(s: BattleState): void {
  for (const u of s.units) {
    if (!u.alive || u.downed || u.dormant) continue;
    let step: Vec2;
    if (u.forced) {
      step = u.forced.vel;
      u.forced.ticksLeft--;
      if (u.forced.ticksLeft <= 0) u.forced = null;
    } else if (u.action || isActionBlocked(u)) {
      step = separation(u, s, 1);
    } else {
      const speed = effectiveStats(u, s).moveSpeed * (u.speedScale ?? 1);
      step = scale(clampLen(add(u.vel, separation(u, s, speed)), speed), s.moveScale);
      if (len(u.vel) > 0.05) u.facing = angleOf(u.vel);
    }
    // fast forced moves in the region are swept in short hops so they cannot tunnel through thin walls
    const hops = s.mode === 'world' ? Math.max(1, Math.ceil((len(step) * DT) / MAX_HOP)) : 1;
    for (let k = 0; k < hops; k++) {
      u.pos = add(u.pos, scale(step, DT / hops));
      resolveObstacles(u, s);
    }
    u.pos = clampToBounds(s.bounds, u.pos, UNIT_RADIUS);
  }
}
