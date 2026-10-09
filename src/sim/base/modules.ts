import { idx, same, type Cell } from '../grid/types';
import { MAX_CLONES } from '../roam/roam';
import type { WorldParty } from '../overworld/worldSim';

/**
 * The base's modules (spec 2026-10-09 §3): the core (the pod itself) and three that unfold beside it when it lands — the
 * lab, the quarters, the workshop. None is built and none is ever lost: the dome keeps the siege off them. The workshop
 * comes down broken and does nothing until it is mended once; the rest is steps bought at each (UPGRADES).
 */
export type ModuleId = 'lab' | 'quarters' | 'workshop';
/** what mending the workshop costs, once (ore) */
export const WORKSHOP_REPAIR = 40;
export interface Module { id: ModuleId; at: Cell; broken?: boolean }

/** a module's four cells (`at` is its north-west one) */
export const footprint = (at: Cell): Cell[] => [{ x: at.x, y: at.y }, { x: at.x + 1, y: at.y }, { x: at.x, y: at.y + 1 }, { x: at.x + 1, y: at.y + 1 }];
export const moduleOf = (p: WorldParty, id: ModuleId): Module | undefined => p.modules?.find((m) => m.id === id);
export const moduleAt = (p: WorldParty, c: Cell): Module | undefined => p.modules?.find((m) => footprint(m.at).some((x) => same(x, c)));
/** whether what the module does is to be had: it stands unbroken (a land with no modules at all — the old surface — lacks nothing) */
export const moduleOn = (p: WorldParty, id: ModuleId): boolean => !p.modules || !!p.modules.find((m) => m.id === id && !m.broken);

/** where the three stand when the pod has just landed (from the pod's north-west cell): the workshop came down broken */
const START: Record<ModuleId, [number, number]> = { lab: [-3, 0], quarters: [3, 0], workshop: [0, -3] };

/** The pod has landed: its three modules stand round it (the lab where the clone printer is), each four cells in the way. */
export function placeModules(p: WorldParty): void {
  p.modules = (Object.keys(START) as ModuleId[]).map((id) => {
    const at = id === 'lab' && p.cloner ? p.cloner : { x: p.base.x + START[id][0], y: p.base.y + START[id][1] };
    // whatever grew there is cleared (the clearing round the pod is open ground anyway)
    for (const c of footprint(at)) { p.s.map.tiles[idx(p.s.map, c)] = 'chasm'; if (p.ground[idx(p.s.map, c)] !== 'grass') p.ground[idx(p.s.map, c)] = 'grass'; }
    return { id, at, ...(id === 'workshop' ? { broken: true } : {}) };
  });
}

/** Mends the workshop (it came down broken): once, for ore. */
export function repairModule(p: WorldParty, id: ModuleId): boolean {
  const m = moduleOf(p, id);
  if (!m?.broken || p.ore < WORKSHOP_REPAIR) return false;
  p.ore -= WORKSHOP_REPAIR; m.broken = false;
  return true;
}

/**
 * What the modules can be given (spec §3). `gather` and `medical` are functions that start switched off; the rest are steps.
 * Each row: the module it belongs to, and what each next step costs (ore, crystal).
 */
export const UPGRADES = {
  /** the core: clones left at home work the wreck — each brings a little ore per trip down */
  gather: { module: 'core', cost: [[40, 0]] },
  /** the lab: clones come home healed */
  medical: { module: 'lab', cost: [[60, 5]] },
  /** the quarters: one more clone per bed (two to begin with) */
  beds: { module: 'quarters', cost: [[30, 0], [50, 0], [80, 5], [120, 10]] },
  /** the workshop: taking gear apart yields more */
  salvage: { module: 'workshop', cost: [[40, 0]] },
} as const satisfies Record<string, { module: 'core' | ModuleId; cost: readonly (readonly [number, number])[] }>;
export type BaseUpgrade = keyof typeof UPGRADES;

export const upgradeLevel = (p: WorldParty, id: BaseUpgrade): number => p.upgrades?.[id] ?? 0;
/** the next step's cost (undefined at the top) */
export const upgradeCost = (p: WorldParty, id: BaseUpgrade): readonly [number, number] | undefined => UPGRADES[id].cost[upgradeLevel(p, id)];
const home = (p: WorldParty, id: BaseUpgrade): boolean => { const m = UPGRADES[id].module; return m === 'core' || moduleOn(p, m); };
export function canUpgrade(p: WorldParty, id: BaseUpgrade): boolean {
  const cost = upgradeCost(p, id);
  return !!cost && home(p, id) && p.ore >= cost[0] && p.crystal >= cost[1];
}
export function upgrade(p: WorldParty, id: BaseUpgrade): boolean {
  if (!canUpgrade(p, id)) return false;
  const cost = upgradeCost(p, id)!;
  p.ore -= cost[0]; p.crystal -= cost[1];
  p.upgrades = { ...p.upgrades, [id]: upgradeLevel(p, id) + 1 };
  return true;
}
/** whether a switched-on function works now: bought, and its module standing */
export const upgradeOn = (p: WorldParty, id: BaseUpgrade): boolean => upgradeLevel(p, id) > 0 && home(p, id);

/** how many clones the base holds: two beds to begin with and one more per bed added (the old surface: three) */
export const cloneCap = (p: WorldParty): number => (p.modules ? 2 + upgradeLevel(p, 'beds') : MAX_CLONES);

/** what each clone left at home brings in while another is down below (the core's gathering switched on) */
export const GATHER = { ore: 3 };
/** A trip down is over: what the clones that stayed brought in meanwhile (null: nothing; the caller adds it to the stores). */
export function gatherHome(p: WorldParty, stayed: number): { ore: number } | null {
  if (!upgradeOn(p, 'gather') || stayed <= 0) return null;
  return { ore: GATHER.ore * stayed };
}
