import type { Vec2 } from '../../core/vec2';
import { steerToward } from '../battle/movement';
import type { UnitState } from '../battle/types';
import type { AiState, WorldState } from './types';
import { groupOf } from './activation';
import { emitW, heroUnit, setAware } from './worldState';

export const LEASH = 20;
const LEASH_HERO = 8;
const WALK = 0.6;
const REPATH_TICKS = 10;

/** Walks u toward dest along the nav grid (re-planned every half second). Returns true on arrival. */
export function walkTo(w: WorldState, u: UnitState, st: AiState, dest: Vec2, speedScale: number): boolean {
  if (Math.hypot(dest.x - u.pos.x, dest.y - u.pos.y) < 0.6) {
    u.vel = { x: 0, y: 0 };
    st.path = undefined;
    return true;
  }
  if (!st.path || st.repathIn-- <= 0) {
    st.path = w.nav.path(u.pos, dest) ?? [dest];
    st.repathIn = REPATH_TICKS;
  }
  while (st.path.length > 1 && Math.hypot(st.path[0]!.x - u.pos.x, st.path[0]!.y - u.pos.y) < 0.6) st.path.shift();
  steerToward(u, st.path[0]!, w.b, 0.05);
  u.vel = { x: u.vel.x * speedScale, y: u.vel.y * speedScale };
  return false;
}

function goHome(w: WorldState, g: string): void {
  const grp = w.groups[g]!;
  grp.alerted = false;
  for (const id of grp.members) {
    const st = w.ai[id]!;
    st.mode = 'return';
    st.path = undefined;
    const u = w.b.units.find((x) => x.id === id);
    if (u?.alive) setAware(u, false);
  }
  emitW(w, 'lost', { group: g });
}

/** Unaware enemies stand guard or walk their loop; chasers that stray too far give up and walk home. */
export function updatePatrol(w: WorldState): void {
  const hero = heroUnit(w);
  for (const u of w.b.units) {
    if (u.team !== 'enemy' || !u.alive) continue;
    const st = w.ai[u.id];
    if (!st) continue;
    const g = groupOf(w, u.id);
    const grp = w.groups[g];
    if (st.mode === 'alert') {
      const far = Math.hypot(u.pos.x - st.home.x, u.pos.y - st.home.y) > LEASH;
      const heroFar = Math.hypot(u.pos.x - hero.pos.x, u.pos.y - hero.pos.y) > LEASH_HERO;
      if (!grp?.hunter && far && heroFar) goHome(w, g);
      continue;
    }
    if (st.mode === 'return') {
      // out of sight and asleep: no need to animate the walk
      const home = u.dormant || walkTo(w, u, st, st.home, WALK);
      if (home) {
        if (u.dormant) u.pos = { ...st.home };
        u.hp = u.maxHp;
        st.mode = w.routes[u.id] ? 'patrol' : 'idle';
        u.vel = { x: 0, y: 0 };
      }
      continue;
    }
    if (u.dormant) continue;
    const route = w.routes[u.id];
    if (st.mode === 'patrol' && route?.length) {
      if (walkTo(w, u, st, route[st.wp % route.length]!, WALK)) st.wp = (st.wp + 1) % route.length;
      if (Math.hypot(u.vel.x, u.vel.y) > 0.05) u.facing = Math.atan2(u.vel.y, u.vel.x);
    } else {
      u.vel = { x: 0, y: 0 };
    }
  }
}
