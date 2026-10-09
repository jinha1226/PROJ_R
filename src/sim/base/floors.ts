import { drillCost, LIFT_STOPS, startFloors } from './drill';
import { isBossFloor, zoneOf, type ZoneId } from '../grid/zones';
import type { WorldParty } from '../overworld/worldSim';

export const FLOORS = 15;

/** One floor under the base, as the base knows it: what has been seen of it and what the lift does there. */
export interface FloorRow {
  floor: number; zone: string; zoneId: ZoneId;
  /** a clone has stood on it */
  reached: boolean;
  /** a clone has gone on below it (its guardian, if it had one, is beaten) */
  passed: boolean;
  /** the lift stops here: a clone can be sent down to it */
  stop: boolean;
  /** the lift's next stop, and what the shaft down to it costs */
  next?: { ore: number; crystal: number };
  boss: boolean;
  /** a return beacon keeps this floor waiting */
  kept: boolean;
}

/** how deep anyone has been (0: nobody has gone down yet — the record itself starts at floor 1) */
export const deepestSeen = (p: WorldParty, kept?: number): number => (p.trips > 0 || kept !== undefined || p.deepest > 1 ? Math.max(p.deepest, kept ?? 0) : 0);

/** The floors under the base, top to bottom (`kept`: the floor a beacon keeps). */
export function floorRows(p: WorldParty, kept?: number): FloorRow[] {
  const stops = startFloors(p), nextStop = LIFT_STOPS[p.drillLevel + 1], cost = drillCost(p.drillLevel + 1), deepest = deepestSeen(p, kept);
  return Array.from({ length: FLOORS }, (_, i) => {
    const floor = i + 1, z = zoneOf(floor);
    return { floor, zone: z.name, zoneId: z.id, reached: floor <= deepest, passed: floor < deepest, stop: stops.includes(floor), next: floor === nextStop && cost ? cost : undefined, boss: isBossFloor(floor), kept: floor === kept };
  });
}

/** where a clone sent now would go: the kept floor if one waits, else the chosen stop (the deepest stop when none is chosen) */
export const destination = (p: WorldParty, kept: number | undefined, sel: number): number => kept ?? (startFloors(p).includes(sel) ? sel : startFloors(p).at(-1)!);
