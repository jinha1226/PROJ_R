import { add, dist, norm, perp, scale, sub, v, type Vec2 } from '../../../core/vec2';
import { getSkill } from '../../../data/skills';
import type { SkillDef } from '../../../data/types';
import { isReady } from '../actions';
import { ARENA, UNIT_RADIUS } from '../constants';
import { telegraphThreatFor } from '../telegraphs';
import type { BattleState, Telegraph, UnitState } from '../types';

export type CandidateKind = 'skill' | 'approach' | 'kite' | 'dodge' | 'rescue' | 'guard' | 'protect' | 'flee' | 'idle';

export interface Candidate {
  kind: CandidateKind;
  skillId?: string;
  skill?: SkillDef;
  target?: UnitState;
  /** ally the candidate serves (protect) */
  ally?: UnitState;
  dest?: Vec2;
  inRange?: boolean;
}

const DODGE_WINDOW = 15;

/** Extra candidate sources (relationships, pair combos) registered by personality modules. */
export type CandidateGenerator = (u: UnitState, s: BattleState) => Candidate[];
export const candidateGenerators: CandidateGenerator[] = [];
export function registerCandidateGenerator(g: CandidateGenerator): void {
  candidateGenerators.push(g);
}
const IN_RANGE_SLACK = 0.2;

export const clampToArena = (p: Vec2): Vec2 => ({
  x: Math.min(ARENA.maxX - 0.6, Math.max(ARENA.minX + 0.6, p.x)),
  y: Math.min(ARENA.maxY - 0.6, Math.max(ARENA.minY + 0.6, p.y)),
});

export const foesOf = (u: UnitState, s: BattleState): UnitState[] => s.units.filter((o) => o.alive && o.team !== u.team);
export const friendsOf = (u: UnitState, s: BattleState): UnitState[] =>
  s.units.filter((o) => o.alive && !o.downed && o.team === u.team);

export function nearest(u: UnitState, list: UnitState[]): UnitState | undefined {
  let best: UnitState | undefined;
  for (const o of list) if (!best || dist(u.pos, o.pos) < dist(u.pos, best.pos)) best = o;
  return best;
}

function enemyTargets(u: UnitState, s: BattleState): UnitState[] {
  const taunt = u.tags.find((t) => t.tag === 'taunted');
  if (taunt) {
    const src = s.units.find((o) => o.id === taunt.srcId && o.alive && !o.downed);
    if (src) return [src];
  }
  return foesOf(u, s);
}

function dodgeDest(u: UnitState, t: Telegraph): Vec2 {
  const a = t.area;
  const margin = 0.8 + UNIT_RADIUS;
  if (a.shape === 'circle' || a.shape === 'cone') {
    const away = sub(u.pos, t.origin);
    const dir = away.x === 0 && away.y === 0 ? perp(t.dir) : norm(away);
    return clampToArena(add(t.origin, scale(dir, a.radius * t.areaMult + margin)));
  }
  const n = norm(t.dir);
  const rel = sub(u.pos, t.origin);
  const side = rel.x * n.y - rel.y * n.x >= 0 ? -1 : 1;
  return clampToArena(add(u.pos, scale(perp(n), side * ((a.width * t.areaMult) / 2 + margin))));
}

function kiteDest(u: UnitState, s: BattleState, threat: UnitState): Vec2 {
  if (u.setup.tactics.includes('useCover') && s.obstacles.length) {
    const o = s.obstacles.reduce((b, c) => (dist(c.pos, u.pos) < dist(b.pos, u.pos) ? c : b));
    return clampToArena(add(o.pos, scale(norm(sub(o.pos, threat.pos)), o.radius + 0.8)));
  }
  return clampToArena(add(u.pos, scale(norm(sub(u.pos, threat.pos)), 3)));
}

export function generateCandidates(u: UnitState, s: BattleState): Candidate[] {
  const out: Candidate[] = [];
  const kit = [u.setup.basic, ...u.setup.actives, ...(u.setup.ultimate ? [u.setup.ultimate] : [])];
  for (const id of kit) {
    if (!isReady(u, id)) continue;
    const skill = getSkill(id);
    const targets = skill.target === 'enemy' ? enemyTargets(u, s) : skill.target === 'ally' ? friendsOf(u, s) : [u];
    for (const target of targets) {
      const inRange = skill.target === 'self' || dist(u.pos, target.pos) <= skill.range + IN_RANGE_SLACK;
      out.push({ kind: 'skill', skillId: id, skill, target, inRange });
    }
  }
  const foes = foesOf(u, s).filter((f) => !f.downed);
  const close = nearest(u, foes);
  if (close && u.setup.stats.range >= 4 && dist(u.pos, close.pos) <= u.setup.stats.range * 0.4)
    out.push({ kind: 'kite', target: close, dest: kiteDest(u, s, close) });
  const danger = telegraphThreatFor(u, s);
  if (danger && danger.ticksLeft <= DODGE_WINDOW) out.push({ kind: 'dodge', dest: dodgeDest(u, danger.tel) });
  if (u.team === 'ally')
    for (const d of s.units)
      if (d.team === u.team && d.alive && d.downed && !d.rescueUsed) out.push({ kind: 'rescue', target: d });
  if (u.setup.tactics.includes('guardBack'))
    for (const f of foes) {
      const victim = s.units.find((a) => a.id === f.intent?.targetId && a.team === u.team && a.line === 'back' && a !== u);
      if (victim) out.push({ kind: 'guard', target: f, dest: add(victim.pos, scale(sub(f.pos, victim.pos), 0.35)) });
    }
  if (u.emotions.some((e) => e.id === 'fear'))
    out.push({ kind: 'flee', dest: clampToArena(v(u.pos.x + (u.team === 'ally' ? -4 : 4), u.pos.y)) });
  for (const g of candidateGenerators) out.push(...g(u, s));
  out.push({ kind: 'idle', dest: v(u.pos.x, u.pos.y) });
  return out;
}

