import type { Vec2 } from '../../core/vec2';
import type { BattleState, Bounds, Obstacle } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Moves a circle of radius r centred at p out of the obstacle (circle or axis-aligned box). */
export function pushOutOfObstacle(p: Vec2, r: number, o: Obstacle): Vec2 {
  if (o.kind === 'box' && o.half) {
    const lo = { x: o.pos.x - o.half.x, y: o.pos.y - o.half.y };
    const hi = { x: o.pos.x + o.half.x, y: o.pos.y + o.half.y };
    const c = { x: clamp(p.x, lo.x, hi.x), y: clamp(p.y, lo.y, hi.y) };
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d >= r) return p;
    if (d > 0) return { x: c.x + (dx / d) * r, y: c.y + (dy / d) * r };
    // centre inside the box: leave through the nearest side
    const exits = [
      { pen: p.x - lo.x, to: { x: lo.x - r, y: p.y } },
      { pen: hi.x - p.x, to: { x: hi.x + r, y: p.y } },
      { pen: p.y - lo.y, to: { x: p.x, y: lo.y - r } },
      { pen: hi.y - p.y, to: { x: p.x, y: hi.y + r } },
    ];
    return exits.reduce((a, b) => (b.pen < a.pen ? b : a)).to;
  }
  const min = o.radius + r;
  const dx = p.x - o.pos.x;
  const dy = p.y - o.pos.y;
  const d = Math.hypot(dx, dy);
  if (d >= min) return p;
  if (d === 0) return { x: o.pos.x + min, y: o.pos.y };
  return { x: o.pos.x + (dx / d) * min, y: o.pos.y + (dy / d) * min };
}

/** Slab test: does segment a→b cross the box? */
function segmentHitsBox(a: Vec2, b: Vec2, o: Obstacle): boolean {
  const h = o.half!;
  let t0 = 0;
  let t1 = 1;
  const d = { x: b.x - a.x, y: b.y - a.y };
  for (const [p, dd, lo, hi] of [[a.x, d.x, o.pos.x - h.x, o.pos.x + h.x], [a.y, d.y, o.pos.y - h.y, o.pos.y + h.y]] as const) {
    if (Math.abs(dd) < 1e-12) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let ta = (lo - p) / dd;
    let tb = (hi - p) / dd;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Line of sight: only walls (boxes) block it, so arena battles with rocks and pillars are unchanged. */
export function segmentBlocked(s: BattleState, a: Vec2, b: Vec2): boolean {
  return s.obstacles.some((o) => o.kind === 'box' && !!o.half && segmentHitsBox(a, b, o));
}

export function clampToBounds(b: Bounds, p: Vec2, margin: number): Vec2 {
  return { x: clamp(p.x, b.minX + margin, b.maxX - margin), y: clamp(p.y, b.minY + margin, b.maxY - margin) };
}
