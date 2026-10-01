import { segmentBlocked } from '../battle/geometry';
import type { WorldState } from './types';
import { groupOf } from './activation';
import { emitW, heroUnit, setAware, unit } from './worldState';

export const SIGHT_DAY = 10;
export const SIGHT_NIGHT = 7;
export const SENSE_CLOSE = 3;
const HALF_CONE = (50 * Math.PI) / 180;

/** Alerts a whole group: every member switches to the battle AI. */
export function alertGroup(w: WorldState, g: string): void {
  const grp = w.groups[g];
  if (!grp || grp.alerted) return;
  grp.alerted = true;
  for (const id of grp.members) {
    const u = unit(w, id);
    if (!u.alive) continue;
    w.ai[id]!.mode = 'alert';
    setAware(u, true);
  }
  emitW(w, 'spotted', { group: g });
}

/** Awake, unaware enemies look for the hero: a forward cone, or anything very close; walls block sight. */
export function updatePerception(w: WorldState, night = false): void {
  const hero = heroUnit(w);
  if (!hero.alive || hero.downed || w.hero.hiddenUntil > w.b.tick) return;
  const sight = night ? SIGHT_NIGHT : SIGHT_DAY;
  for (const u of w.b.units) {
    if (u.team !== 'enemy' || !u.alive || u.dormant || w.ai[u.id]?.mode === 'alert') continue;
    const dx = hero.pos.x - u.pos.x;
    const dy = hero.pos.y - u.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > sight) continue;
    let off = Math.abs(Math.atan2(dy, dx) - u.facing) % (Math.PI * 2);
    if (off > Math.PI) off = Math.PI * 2 - off;
    if ((d <= SENSE_CLOSE || off <= HALF_CONE) && !segmentBlocked(w.b, u.pos, hero.pos)) alertGroup(w, groupOf(w, u.id));
  }
}
