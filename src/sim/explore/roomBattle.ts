import { add, angleOf, scale, sub, type Vec2 } from '../../core/vec2';
import { enemyFromDef } from '../battle/setup';
import type { BattleSetup, Obstacle } from '../battle/types';
import { mercToUnitSetup } from '../roster/toSetup';
import type { RunState, Slot } from '../run/types';
import { DOOR_POS, ROOM_HALF } from './generate';
import { stageOf } from './progress';
import type { Dir, Prop } from './types';

const FORWARD: Record<Dir, Vec2> = { n: { x: 0, y: 1 }, s: { x: 0, y: -1 }, e: { x: -1, y: 0 }, w: { x: 1, y: 0 } };
const ANCHOR_IN = 5.2;
const MARGIN = 0.8;

const toObstacle = (p: Prop): Obstacle => ({ pos: { x: p.x, y: p.y }, radius: p.r, kind: p.kind === 'pillar' || p.kind === 'crypt' ? 'pillar' : 'rock' });

function free(p: Vec2, obstacles: Obstacle[], taken: Vec2[]): boolean {
  if (Math.abs(p.x) > ROOM_HALF.x - MARGIN || Math.abs(p.y) > ROOM_HALF.y - MARGIN) return false;
  if (obstacles.some((o) => Math.hypot(o.pos.x - p.x, o.pos.y - p.y) < o.radius + 0.6)) return false;
  return !taken.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 0.9);
}

/** Nearest free point on a small spiral around p. */
function settle(p: Vec2, obstacles: Obstacle[], taken: Vec2[]): Vec2 {
  for (let ring = 0; ring < 12; ring++)
    for (let k = 0; k < Math.max(1, ring * 6); k++) {
      const a = (Math.PI * 2 * k) / Math.max(1, ring * 6);
      const q = { x: p.x + Math.cos(a) * ring * 0.6, y: p.y + Math.sin(a) * ring * 0.6 };
      const c = { x: Math.max(-ROOM_HALF.x + MARGIN, Math.min(ROOM_HALF.x - MARGIN, q.x)), y: Math.max(-ROOM_HALF.y + MARGIN, Math.min(ROOM_HALF.y - MARGIN, q.y)) };
      if (free(c, obstacles, taken)) return c;
    }
  return p;
}

/**
 * The room itself is the battlefield: allies enter through the door they came in (formation rotated to face
 * into the room), enemies start where they stood, and the room's props are cover.
 */
export function roomBattleSetup(run: RunState, roomId: string, formation: Record<string, Slot>): BattleSetup {
  const e = run.exploration!;
  const room = e.rooms[roomId]!;
  const entry: Dir = e.enteredFrom ?? 'w';
  const fwd = FORWARD[entry];
  const side = { x: -fwd.y, y: fwd.x };
  const anchor = add(DOOR_POS[entry], scale(fwd, ANCHOR_IN));
  const obstacles = room.props.map(toObstacle);
  const taken: Vec2[] = [];
  const mercs = e.party.map((id) => run.roster.mercs.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m && m.alive);
  const allies = mercs.map((m, i) => {
    const slot = formation[m.id] ?? { col: 2, row: (i % 4) as Slot['row'] };
    const local = add(scale(fwd, (slot.col - 1) * 2.2), scale(side, (slot.row - 1.5) * 2.0));
    const spawn = settle(add(anchor, local), obstacles, taken);
    taken.push(spawn);
    return { ...mercToUnitSetup(m, i, slot), spawn, facing: angleOf(fwd) };
  });
  const stage = stageOf(e, room);
  const enemies = (room.enemies ?? []).map((en, i) => {
    const spawn = settle({ x: en.x, y: en.y }, obstacles, taken);
    taken.push(spawn);
    return { ...enemyFromDef(en.enemyId, 2, 0, stage, i), spawn, facing: angleOf(sub(anchor, spawn)) };
  });
  const ids = new Set(allies.map((a) => a.id));
  const seed = (e.seed ^ [...roomId].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381)) >>> 0;
  return { seed, allies, enemies, obstacles, relations: run.roster.relations.filter((r) => ids.has(r.a) && ids.has(r.b)).map((r) => ({ ...r })) };
}
