import { newDelve, type DelveParty } from '../delve/delveSim';
import type { GEvent } from '../grid/types';
import type { WorldParty } from '../overworld/worldSim';
import type { Carry } from '../roam/carry';

const COSTS = [{ ore: 30, crystal: 0 }, { ore: 60, crystal: 5 }, { ore: 100, crystal: 15 }];
/** Cost to reach a level; undefined for unsupported levels. */
export const drillCost = (level: number): { ore: number; crystal: number } | undefined => COSTS[level - 1];
/** the floors the lift can stop at, one more with each level of the drill */
export const LIFT_STOPS = [1, 3, 5, 8];
export const startFloors = (p: WorldParty): number[] => LIFT_STOPS.slice(0, p.drillLevel + 1);
export function canUpgradeDrill(p: WorldParty): boolean {
  const cost = drillCost(p.drillLevel + 1);
  return !!cost && p.ore >= cost.ore && p.crystal >= cost.crystal;
}
export function upgradeDrill(p: WorldParty, ev: GEvent[] = []): boolean {
  if (!canUpgradeDrill(p)) return false;
  const cost = drillCost(++p.drillLevel)!;
  p.ore -= cost.ore; p.crystal -= cost.crystal;
  ev.push({ t: p.time, type: 'buff', text: 'drill' });
  return true;
}
/** Shared expedition entry, rejecting a depth the drill has not opened. */
export function startDelve(p: WorldParty, seed: number, carry: Carry, floor = 1): DelveParty | null {
  return startFloors(p).includes(floor) ? newDelve(seed, floor, carry) : null;
}
