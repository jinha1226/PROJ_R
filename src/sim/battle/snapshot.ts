import type { BattleState, Snapshot } from './types';

export function makeSnapshot(s: BattleState): Snapshot {
  return {
    tick: s.tick,
    units: s.units.map((u) => ({
      id: u.id, x: u.pos.x, y: u.pos.y, facing: u.facing, hp: u.hp, maxHp: u.maxHp, shield: u.shield,
      momentum: u.momentum, alive: u.alive, downed: u.downed, lifeline: u.lifeline,
      action: u.action
        ? { skillId: u.action.skillId, phase: u.action.phase, progress: 1 - u.action.ticksLeft / u.action.totalTicks }
        : null,
      tags: u.tags.map((t) => t.tag),
      intent: u.intent,
      forced: u.forced?.kind ?? null,
    })),
    telegraphs: s.telegraphs.map((t) => ({
      id: t.id, skillId: t.skillId, team: t.team, area: t.area, origin: t.origin, dir: t.dir, areaMult: t.areaMult,
      progress: Math.min(1, (s.tick - t.startedAt) / Math.max(1, t.firesAt - t.startedAt)),
    })),
    projectiles: s.projectiles.map((p) => ({ id: p.id, x: p.pos.x, y: p.pos.y, visual: p.visual })),
  };
}
