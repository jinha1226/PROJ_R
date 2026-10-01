import { norm, scale, sub } from '../../../core/vec2';
import { startAction } from '../actions';
import { DECISION_INTERVAL, RESCUE_RANGE } from '../constants';
import { emit } from '../events';
import { steerToward } from '../movement';
import { effectiveStats } from '../stats';
import { isActionBlocked } from '../tags';
import type { BattleState, Intent, IntentKind, UnitState } from '../types';
import { generateCandidates, type Candidate } from './candidates';
import { considerations, makeCtx, type Ctx } from './considerations';
import { tacticConsiderations } from './tactics';

const ROLL_SPEED = 6;
const ROLL_TICKS = 6;

interface Scored {
  c: Candidate;
  total: number;
  reasons: { reason: string; value: number }[];
}

function score(c: Candidate, ctx: Ctx): Scored {
  let total = 0;
  const reasons: Scored['reasons'] = [];
  for (const k of [...considerations, ...tacticConsiderations]) {
    const val = k.score(c, ctx);
    if (val === 0) continue;
    total += val;
    if (k.reason && val > 0) reasons.push({ reason: k.reason, value: val });
  }
  reasons.sort((a, b) => b.value - a.value);
  return { c, total, reasons };
}

function defaultReason(c: Candidate): string {
  if (c.kind === 'skill') return c.inRange ? (c.skill!.kind === 'basic' ? 'attack' : 'skill') : 'approach';
  return c.kind;
}

function intentKind(c: Candidate): IntentKind {
  if (c.kind === 'skill') return c.inRange ? (c.skill!.kind === 'basic' ? 'attack' : 'skill') : 'approach';
  return c.kind;
}

function execute(s: BattleState, u: UnitState, c: Candidate): void {
  if (c.kind !== 'rescue' || c.target?.id !== u.rescueTarget) u.rescueProgress = 0;
  u.rescueTarget = null;
  if (c.kind === 'skill' && c.inRange) {
    startAction(s, u, c.skillId!, c.target?.id, c.target ? { ...c.target.pos } : undefined);
  } else if (c.kind === 'skill' && c.target) {
    steerToward(u, c.target.pos, s, c.skill!.range * 0.9);
  } else if (c.kind === 'rescue' && c.target) {
    steerToward(u, c.target.pos, s, RESCUE_RANGE * 0.8);
    u.rescueTarget = c.target.id;
  } else if (c.kind === 'dodge' && c.dest && (u.setup.role === 'skirmisher' || u.setup.tactics.includes('dangerFirst'))) {
    u.forced = { vel: scale(norm(sub(c.dest, u.pos)), ROLL_SPEED), ticksLeft: ROLL_TICKS, kind: 'roll' };
    emit(s, { type: 'dodge_roll', src: u.id, pos: c.dest });
  } else if (c.dest && c.kind !== 'idle') {
    steerToward(u, c.dest, s, 0.2);
  } else {
    u.vel = { x: 0, y: 0 };
  }
}

const sameIntent = (a: Intent | null, b: Intent): boolean =>
  !!a && a.kind === b.kind && a.targetId === b.targetId && a.skillId === b.skillId;

export function decideUnit(s: BattleState, u: UnitState): void {
  const ctx = makeCtx(u, s, effectiveStats(u, s));
  let best: Scored | null = null;
  for (const c of generateCandidates(u, s)) {
    const sc = score(c, ctx);
    if (!best || sc.total > best.total) best = sc;
  }
  if (!best) return;
  const { c } = best;
  const intent: Intent = {
    kind: intentKind(c), skillId: c.skillId, targetId: c.target?.id, dest: c.dest,
    reason: best.reasons[0]?.reason ?? defaultReason(c),
    detail: [...new Set(best.reasons.map((r) => r.reason))].slice(0, 3),
  };
  if (!sameIntent(u.intent, intent))
    emit(s, { type: 'intent', src: u.id, dst: intent.targetId, skillId: intent.skillId, reason: intent.reason, data: { kind: intent.kind } });
  u.intent = intent;
  execute(s, u, c);
}

export function decide(s: BattleState): void {
  for (const u of [...s.units]) {
    if (!u.alive || u.downed) continue;
    u.decisionIn--;
    if (u.action || u.forced || isActionBlocked(u) || u.decisionIn > 0) continue;
    u.decisionIn = DECISION_INTERVAL;
    decideUnit(s, u);
  }
}
