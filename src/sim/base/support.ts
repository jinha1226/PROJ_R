import { dist, idx, type Cell, type GEvent } from '../grid/types';
import { alive, damage, entOf, posOf, type Unit } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';

/**
 * Ship support (spec 2026-10-08 §6): the colony ship in orbit fires on a raid — an orbital strike (a cell and two round it)
 * and an orbital laser (a straight line from the pod through the cell). Unlocked with crystal at the pod; each waits its cooldown.
 */
export type SupportId = 'strike' | 'laser';
export const SUPPORT: Record<SupportId, { name: string; cost: [number, number]; cd: number; dmg: number }> = {
  strike: { name: '궤도 포격', cost: [60, 15], cd: 20, dmg: 40 },
  laser: { name: '궤도 레이저', cost: [80, 25], cd: 25, dmg: 30 },
};

const raiders = (p: WorldParty): Unit[] => (p.raid ? p.units.filter((u) => u.side === 'foe' && u.group === p.raid!.group && alive(p, u)) : []);
const ready = (p: WorldParty, id: SupportId) => !!p.support?.[id] && p.time >= (p.support[`${id}Ready`] ?? 0) && !!p.raid;

/** Opens a support for good (ore, crystal). False when it is open already or short of materials. */
export function unlockSupport(p: WorldParty, id: SupportId): boolean {
  const [ore, crystal] = SUPPORT[id].cost;
  if (p.support?.[id] || p.ore < ore || p.crystal < crystal) return false;
  p.ore -= ore; p.crystal -= crystal; (p.support ??= {})[id] = true;
  return true;
}

/** The strike: every raider within two of the cell takes the blow. */
export function orbitalStrike(p: WorldParty, cell: Cell, ev: GEvent[]): boolean {
  if (!ready(p, 'strike')) return false;
  p.support!.strikeReady = p.time + SUPPORT.strike.cd;
  ev.push({ t: p.time, type: 'buff', text: '궤도 포격', to: { ...cell } });
  for (const u of raiders(p)) if (dist(posOf(p, u), cell) <= 2) damage(p, p.time, 'pod', u, SUPPORT.strike.dmg, ev, true);
  return true;
}

/** The laser: from the pod through the cell to the map's edge, every raider on the line takes the blow. */
export function orbitalLaser(p: WorldParty, cell: Cell, ev: GEvent[]): boolean {
  if (!ready(p, 'laser')) return false;
  p.support!.laserReady = p.time + SUPPORT.laser.cd;
  const m = p.s.map, from = p.base, dx = cell.x - from.x, dy = cell.y - from.y, n = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const line = new Set<number>();
  for (let k = 1; k < Math.max(m.w, m.h); k++) {
    const c = { x: from.x + Math.round((dx * k) / n), y: from.y + Math.round((dy * k) / n) };
    if (c.x < 0 || c.y < 0 || c.x >= m.w || c.y >= m.h) break;
    line.add(idx(m, c));
  }
  ev.push({ t: p.time, type: 'shoot', src: 'pod', from: { ...from }, to: { ...cell }, text: '궤도 레이저' });
  for (const u of raiders(p)) if (line.has(idx(m, entOf(p, u.id)!.pos))) damage(p, p.time, 'pod', u, SUPPORT.laser.dmg, ev, true);
  return true;
}
