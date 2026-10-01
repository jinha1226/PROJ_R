import type { Vec2 } from '../../core/vec2';
import { segmentBlocked } from '../battle/geometry';
import { steerToward } from '../battle/movement';
import type { UnitState } from '../battle/types';
import { followTarget, updateFollow } from './follow';
import { partyUnits } from './party';
import { walkTo } from './patrol';
import type { WorldState } from './types';
import { emitW, heroUnit, setAware } from './worldState';

export const COMBAT_RANGE = 10;
export const CALM_TICKS = 3 * 20;
const COMBAT_LEASH = 10;
const REJOIN = 5;
const RETREAT_TICKS = 3 * 20;
const REGROUP_TICKS = 2 * 20;
const RETREAT_DIST = 8;
const FOCUS_RANGE = 14;
const FOCUS_CONE = (60 * Math.PI) / 180;

const d = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const threats = (w: WorldState): UnitState[] => w.b.units.filter((u) => u.team === 'enemy' && u.alive && !u.downed && !u.dormant && w.ai[u.id]?.mode === 'alert');

/** Combat when alert enemies are near (or someone is down and needs rescuing); explore again after a calm spell. */
export function updatePartyMode(w: WorldState): void {
  const party = partyUnits(w);
  const foes = threats(w);
  const focus = w.b.focusTargetId ? w.b.units.find((u) => u.id === w.b.focusTargetId && u.alive && !u.downed) : undefined;
  if (w.b.focusTargetId && !focus) w.b.focusTargetId = undefined;
  const hot = !!focus || party.some((p) => p.downed && !p.rescueUsed) || foes.some((f) => party.some((p) => !p.downed && d(f.pos, p.pos) <= COMBAT_RANGE));
  if (hot) {
    w.party.calmTicks = 0;
    if (w.party.mode === 'explore') {
      w.party.mode = 'combat';
      emitW(w, 'combat');
    }
  } else if (w.party.mode === 'combat' && ++w.party.calmTicks >= CALM_TICKS) {
    w.party.mode = 'explore';
    w.b.focusTargetId = undefined;
    emitW(w, 'calm');
  }
  const commanded = !!w.party.command && w.party.command.until > w.b.tick;
  const lead = heroUnit(w);
  for (const u of party) {
    if (u.downed) continue;
    // a member far from the leader breaks off and catches up, and only rejoins the fight once close again
    const st = (w.party.follow[u.id] ??= { repathIn: 0 });
    const gap = d(u.pos, lead.pos);
    if (u.id !== lead.id) st.leashed = gap > COMBAT_LEASH || (!!st.leashed && gap > REJOIN);
    const ai = w.party.mode === 'combat' && !commanded && !st.leashed && !(u.id === w.heroId && w.party.leaderSteered);
    setAware(u, ai);
    if (ai) u.speedScale = undefined;
  }
}

/** Focus fire, retreat and regroup: the only orders the player gives in a fight. */
export function applyCommand(w: WorldState, input: { focus?: boolean; retreat?: boolean; regroup?: boolean }): void {
  const lead = heroUnit(w);
  if (input.focus) {
    // any enemy in sight will do — picking one that has not noticed us is an ambush
    const inReach = w.b.units.filter((f) => f.team === 'enemy' && f.alive && !f.downed && !f.dormant && d(f.pos, lead.pos) <= FOCUS_RANGE && !segmentBlocked(w.b, lead.pos, f.pos));
    const off = (f: UnitState) => {
      const a = Math.abs(Math.atan2(f.pos.y - lead.pos.y, f.pos.x - lead.pos.x) - lead.facing) % (Math.PI * 2);
      return a > Math.PI ? Math.PI * 2 - a : a;
    };
    const byDist = (a: UnitState, b: UnitState) => d(a.pos, lead.pos) - d(b.pos, lead.pos) || (a.id < b.id ? -1 : 1);
    const pick = inReach.filter((f) => off(f) <= FOCUS_CONE).sort(byDist)[0] ?? inReach.sort(byDist)[0];
    if (pick) {
      w.b.focusTargetId = pick.id;
      emitW(w, 'focus', { id: pick.id });
    }
  }
  if (input.retreat) {
    const foes = threats(w).filter((f) => d(f.pos, lead.pos) <= 18);
    const c = foes.length ? { x: foes.reduce((a, f) => a + f.pos.x, 0) / foes.length, y: foes.reduce((a, f) => a + f.pos.y, 0) / foes.length } : { x: lead.pos.x + Math.cos(lead.facing), y: lead.pos.y + Math.sin(lead.facing) };
    const away = { x: lead.pos.x - c.x, y: lead.pos.y - c.y };
    const l = Math.hypot(away.x, away.y) || 1;
    w.party.command = { kind: 'retreat', until: w.b.tick + RETREAT_TICKS, dir: { x: away.x / l, y: away.y / l } };
    emitW(w, 'retreat');
  }
  if (input.regroup) {
    w.party.command = { kind: 'regroup', until: w.b.tick + REGROUP_TICKS };
    emitW(w, 'regroup');
  }
}

/** While an order runs the party moves as one; exploring parties simply follow the leader. */
export function steerParty(w: WorldState): void {
  const cmd = w.party.command;
  const active = cmd && cmd.until > w.b.tick;
  if (cmd && !active) w.party.command = undefined;
  // followers under world control (exploring, or broken off from a fight) walk with the leader
  if (!active) return updateFollow(w);
  const lead = heroUnit(w);
  const members = partyUnits(w).filter((u) => !u.downed);
  if (cmd.kind === 'regroup') return updateFollow(w, members);
  const goal = { x: lead.pos.x + cmd.dir!.x * RETREAT_DIST, y: lead.pos.y + cmd.dir!.y * RETREAT_DIST };
  members.forEach((u, k) => {
    const spot = k === 0 ? goal : { x: goal.x + (followTarget(w, k - 1).x - lead.pos.x), y: goal.y + (followTarget(w, k - 1).y - lead.pos.y) };
    const st = (w.party.follow[u.id] ??= { repathIn: 0 });
    if (u.id === lead.id && w.party.leaderSteered) return;
    if (w.nav.lineClear(u.pos, spot)) steerToward(u, spot, w.b, 0.3);
    else walkTo(w, u, st, spot, 1);
  });
}
