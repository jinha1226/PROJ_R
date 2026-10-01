import type { Vec2 } from '../../core/vec2';
import { segmentBlocked } from '../battle/geometry';
import { UNIT_RADIUS } from '../battle/constants';
import { pushOutOfObstacle } from '../battle/geometry';
import { steerToward } from '../battle/movement';
import type { UnitState } from '../battle/types';
import { partyUnits } from './party';
import { walkTo } from './patrol';
import type { WorldState } from './types';
import { heroUnit } from './worldState';

/** Exploration slots relative to the leader (leader facing = +x): a loose V behind. */
export const SLOT_OFFSETS: Vec2[] = [{ x: -1.6, y: -1.1 }, { x: -1.6, y: 1.1 }, { x: -3.0, y: -1.6 }, { x: -3.0, y: 1.6 }];
const TRAIL_STEP = 0.8;
const TRAIL_MAX = 60;
const QUEUE_GAP = 1.4;
const ARRIVE = 0.5;
const CATCH_UP = 0.35;
const RECOVER_DIST = 25;

const rot = (p: Vec2, a: number): Vec2 => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

function recordTrail(w: WorldState, lead: UnitState): void {
  const t = w.party.trail;
  const last = t[t.length - 1];
  if (!last || dist(last, lead.pos) >= TRAIL_STEP) t.push({ ...lead.pos });
  if (t.length > TRAIL_MAX) t.splice(0, t.length - TRAIL_MAX);
}

/** The point `d` metres behind the leader along their footprints. */
export function trailPoint(w: WorldState, d: number): Vec2 {
  const t = w.party.trail;
  let prev = heroUnit(w).pos;
  let left = d;
  for (let i = t.length - 1; i >= 0; i--) {
    const seg = dist(prev, t[i]!);
    if (seg >= left) return { x: prev.x + ((t[i]!.x - prev.x) * left) / seg, y: prev.y + ((t[i]!.y - prev.y) * left) / seg };
    left -= seg;
    prev = t[i]!;
  }
  return { ...prev };
}

/** Can a unit's body slide straight from a to b (sampled every 0.3 m against the real obstacles)? */
function bodyClear(w: WorldState, a: Vec2, b: Vec2): boolean {
  const n = Math.max(1, Math.ceil(dist(a, b) / 0.3));
  for (let i = 1; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    // slightly slimmer than the body: the leader's own footprints graze trees at exactly one body radius
    if (w.b.obstacles.some((o) => { const q = pushOutOfObstacle(p, UNIT_RADIUS - 0.05, o); return q.x !== p.x || q.y !== p.y; })) return false;
  }
  return true;
}

/** Drops the part of a step that would push into an obstacle, so followers slide around trees and corners instead of pressing into them. */
function slide(w: WorldState, u: UnitState): void {
  const next = { x: u.pos.x + u.vel.x * 0.05, y: u.pos.y + u.vel.y * 0.05 };
  for (const o of w.b.obstacles) {
    const out = pushOutOfObstacle(next, UNIT_RADIUS + 0.02, o);
    const nx = out.x - next.x;
    const ny = out.y - next.y;
    const l = Math.hypot(nx, ny);
    if (l < 1e-9) continue;
    const n = { x: nx / l, y: ny / l };
    const into = u.vel.x * n.x + u.vel.y * n.y;
    if (into < 0) u.vel = { x: u.vel.x - into * n.x, y: u.vel.y - into * n.y };
  }
}

/** The farthest footprint ahead (toward the leader) that the body can reach in a straight line. */
function crumb(w: WorldState, from: Vec2): Vec2 | null {
  const t = w.party.trail;
  let near = -1;
  for (let i = 0; i < t.length; i++) if (near < 0 || dist(from, t[i]!) < dist(from, t[near]!)) near = i;
  if (near < 0) return null;
  for (let j = Math.min(t.length - 1, near + 8); j >= near; j--) if (dist(from, t[j]!) > 0.4 && bodyClear(w, from, t[j]!)) return t[j]!;
  // the leader walked it: head for the next footprint and let sliding take care of grazing a tree
  const next = t[Math.min(t.length - 1, near + 1)]!;
  return dist(from, next) > 0.4 ? next : t[Math.min(t.length - 1, near + 2)] ?? null;
}

/** Where follower k should stand: its V slot when open ground allows, else in line along the leader's footprints. */
export function followTarget(w: WorldState, k: number): Vec2 {
  const lead = heroUnit(w);
  const slot = SLOT_OFFSETS[k] ?? { x: -1.6 * (k + 1), y: 0 };
  const p = rot(slot, lead.facing);
  const want = { x: lead.pos.x + p.x, y: lead.pos.y + p.y };
  if (w.nav.walkable(want) && !segmentBlocked(w.b, lead.pos, want) && w.nav.lineClear(lead.pos, want)) return want;
  return trailPoint(w, QUEUE_GAP * (k + 1));
}

/** Exploration movement: followers walk to their slots (or queue in narrow places), hurry when behind, and a straggler far out of sight is moved up quietly. */
export function updateFollow(w: WorldState, members?: UnitState[]): void {
  const lead = heroUnit(w);
  if (!lead.alive) return;
  recordTrail(w, lead);
  const followers = (members ?? partyUnits(w)).filter((u) => u.id !== lead.id && !u.downed && u.setup.controlled);
  followers.forEach((u, k) => {
    const st = (w.party.follow[u.id] ??= { repathIn: 0 });
    const target = followTarget(w, k);
    const gap = dist(u.pos, lead.pos);
    if (gap > RECOVER_DIST) {
      const back = trailPoint(w, QUEUE_GAP * (k + 1));
      u.pos = w.nav.walkable(back) ? back : { ...lead.pos };
      st.path = undefined;
      u.vel = { x: 0, y: 0 };
      return;
    }
    if (dist(u.pos, target) < ARRIVE) {
      u.vel = { x: 0, y: 0 };
      st.path = undefined;
      return;
    }
    const hurry = 1 + Math.min(1, Math.max(0, (gap - 2) / 4)) * CATCH_UP;
    u.speedScale = hurry;
    // a body-wide straight line (the way the leader slips between trees) beats a detour on the coarse nav grid
    // otherwise walk the leader's own footprints (always passable); the nav grid is the last resort
    let aim: Vec2 | null = bodyClear(w, u.pos, target) ? target : null;
    if (!aim) {
      // keep the footprint already chosen until it is reached or blocked (switching every tick makes them dither)
      const keep = st.crumb && dist(u.pos, st.crumb) > 0.4 && bodyClear(w, u.pos, st.crumb) ? st.crumb : null;
      aim = keep ?? crumb(w, u.pos);
      st.crumb = aim ?? undefined;
    } else st.crumb = undefined;
    if (aim) {
      steerToward(u, aim, w.b, 0.05);
      u.vel = { x: u.vel.x * hurry, y: u.vel.y * hurry };
      st.path = undefined;
    } else walkTo(w, u, st, target, hurry);
    slide(w, u);
    if (Math.hypot(u.vel.x, u.vel.y) > 0.05) u.facing = Math.atan2(u.vel.y, u.vel.x);
  });
}
