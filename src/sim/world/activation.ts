import type { WorldState } from './types';
import { partyUnits } from './party';

export const ACTIVE_RADIUS = 25;
export const MAX_ACTIVE = 20;

/** Wakes enemies near the hero (and every member of an alerted group), nearest first, up to the cap. */
export function updateActivation(w: WorldState): void {
  const party = partyUnits(w).map((u) => u.pos);
  const want = w.b.units
    .filter((u) => u.team === 'enemy' && u.alive)
    .map((u) => ({ u, d: Math.min(...party.map((h) => Math.hypot(u.pos.x - h.x, u.pos.y - h.y))), group: w.groups[groupOf(w, u.id)] }))
    .filter((x) => x.d <= ACTIVE_RADIUS || x.group?.alerted)
    .sort((a, b) => a.d - b.d || (a.u.id < b.u.id ? -1 : 1))
    .slice(0, MAX_ACTIVE);
  const awake = new Set(want.map((x) => x.u));
  for (const u of w.b.units) {
    if (u.team !== 'enemy') continue;
    const sleep = !awake.has(u);
    if (u.dormant && !sleep) u.decisionIn = 1;
    u.dormant = sleep;
  }
}

export const groupOf = (w: WorldState, id: string): string => w.groupOf[id] ?? '';
