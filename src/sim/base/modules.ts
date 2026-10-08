import { distanceMap } from '../grid/path';
import { idx, same, tileAt, walkable, type Cell, type GEvent, type GridMap, type Tile } from '../grid/types';
import { alive, entOf, occupied, posOf } from '../party/partyCore';
import { MAX_CLONES } from '../roam/roam';
import type { WorldParty } from '../overworld/worldSim';

/**
 * The base's modules (spec 2026-10-09 §3): the core (the pod itself: it never moves and its fall loses the raid) and three
 * that unfold beside it when it lands — the lab, the quarters, the workshop. None is built; by day each can be moved,
 * mended and upgraded. A raid attacks them like anything else of ours: one that is broken does nothing until it is mended.
 */
export type ModuleId = 'lab' | 'quarters' | 'workshop';
export const MODULE_HP = 240;
export interface Module { id: ModuleId; at: Cell; hp: number; broken?: boolean; original: { tile: Tile; cover: number }[] }

/** a module's four cells (`at` is its north-west one) */
export const footprint = (at: Cell): Cell[] => [{ x: at.x, y: at.y }, { x: at.x + 1, y: at.y }, { x: at.x, y: at.y + 1 }, { x: at.x + 1, y: at.y + 1 }];
export const moduleOf = (p: WorldParty, id: ModuleId): Module | undefined => p.modules?.find((m) => m.id === id);
export const moduleAt = (p: WorldParty, c: Cell): Module | undefined => p.modules?.find((m) => footprint(m.at).some((x) => same(x, c)));
/** whether what the module does is to be had: it stands unbroken (a land with no modules at all — the old surface — lacks nothing) */
export const moduleOn = (p: WorldParty, id: ModuleId): boolean => !p.modules || !!p.modules.find((m) => m.id === id && !m.broken);

/** where the three stand when the pod has just landed (from the pod's north-west cell): the workshop came down broken */
const START: Record<ModuleId, [number, number]> = { lab: [-3, 0], quarters: [3, 0], workshop: [0, -3] };

const close = (p: WorldParty, m: Module): void => {
  m.original = footprint(m.at).map((c) => ({ tile: tileAt(p.s.map, c), cover: p.cover?.[idx(p.s.map, c)] ?? 0 }));
  for (const c of footprint(m.at)) p.s.map.tiles[idx(p.s.map, c)] = 'chasm';
};
const open = (p: WorldParty, m: Module): void => footprint(m.at).forEach((c, i) => {
  const k = idx(p.s.map, c);
  p.s.map.tiles[k] = m.original[i]!.tile === 'chasm' ? 'floor' : m.original[i]!.tile;
  if (p.cover) p.cover[k] = m.original[i]!.cover;
});

/** The pod has landed: its three modules stand round it (the lab where the clone printer is). */
export function placeModules(p: WorldParty): void {
  p.modules = (Object.keys(START) as ModuleId[]).map((id) => {
    const at = id === 'lab' && p.cloner ? p.cloner : { x: p.base.x + START[id][0], y: p.base.y + START[id][1] };
    const m: Module = { id, at, hp: id === 'workshop' ? 0 : MODULE_HP, original: [], ...(id === 'workshop' ? { broken: true } : {}) };
    // whatever grew there is cleared (the clearing round the pod is open ground anyway)
    for (const c of footprint(at)) if (!walkable(tileAt(p.s.map, c)) && !(p.cloner && same(c, p.cloner))) { p.s.map.tiles[idx(p.s.map, c)] = 'floor'; p.ground[idx(p.s.map, c)] = 'grass'; }
    close(p, m);
    return m;
  });
}

/** the pod's own cells, and the cells kept clear by the shaft (clones coming up step out there) */
const podCell = (p: WorldParty, c: Cell): boolean => c.x >= p.base.x && c.x <= p.base.x + 1 && c.y >= p.base.y && c.y <= p.base.y + 1;
export const reserved = (p: WorldParty, c: Cell): boolean => {
  const s = p.s.map.start;
  return (c.y === s.y && (c.x === s.x || c.x === s.x + 1)) || same(c, { x: s.x, y: s.y + 1 });
};

/** The pod can still be walked to from the land outside (over the cells by the shaft, where the clones come up). */
export function podOpen(p: WorldParty, trial: GridMap): boolean {
  const m = p.s.map, reach = distanceMap(trial, m.start);
  let ring = false;
  for (let y = p.base.y - 1; y <= p.base.y + 2 && !ring; y++) for (let x = p.base.x - 1; x <= p.base.x + 2; x++) if (reach[idx(m, { x, y })]! >= 0) { ring = true; break; }
  return ring && reach.some((d, k) => d >= 0 && Math.hypot((k % m.w) - p.base.x, Math.floor(k / m.w) - p.base.y) > 12);
}

/** a free open cell near `at` that is none of `not` (where a clone standing in the way steps to) */
export function aside(p: WorldParty, at: Cell, not: Cell[] = []): Cell | undefined {
  for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const c = { x: at.x + dx, y: at.y + dy };
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(tileAt(p.s.map, c)) && !occupied(p, c, '') && !not.some((n) => same(n, c))) return c;
  }
  return undefined;
}

/**
 * Whether the module may stand with its north-west cell at `at`: by day, wholly on our own open ground (its own old cells
 * count as open), on no barricade, post, other module or the pod, clear of the cells by the shaft — and the pod still
 * reachable from outside.
 */
export function canMoveModule(p: WorldParty, id: ModuleId, at: Cell): boolean {
  const m = p.s.map, mod = moduleOf(p, id);
  if (!mod || p.raid || !Number.isInteger(at.x) || !Number.isInteger(at.y) || same(at, mod.at)) return false;
  const own = footprint(mod.at), cells = footprint(at);
  for (const c of cells) {
    if (c.x < 1 || c.y < 1 || c.x >= m.w - 1 || c.y >= m.h - 1 || !p.claimed[idx(m, c)] || podCell(p, c) || reserved(p, c)) return false;
    const mine = own.some((o) => same(o, c));
    if (!mine && !walkable(tileAt(m, c))) return false;
    if (p.buildings.some((b) => same(b.at, c)) || p.units.some((u) => u.post && same(u.post, c))) return false;
    const other = moduleAt(p, c);
    if (other && other !== mod) return false;
  }
  const trial = { ...m, tiles: [...m.tiles] };
  own.forEach((c, i) => { trial.tiles[idx(m, c)] = mod.original[i]!.tile === 'chasm' ? 'floor' : mod.original[i]!.tile; });
  for (const c of cells) trial.tiles[idx(m, c)] = 'chasm';
  return podOpen(p, trial);
}

/** Moves the module (free, by day). Clones standing where it goes step aside: `ev` carries their steps for the view. */
export function moveModule(p: WorldParty, id: ModuleId, at: Cell, ev: GEvent[] = []): boolean {
  const mod = moduleOf(p, id);
  if (!mod || !canMoveModule(p, id, at)) return false;
  const cells = footprint(at);
  for (const u of p.units.filter((x) => x.side === 'hero' && alive(p, x) && cells.some((c) => same(c, posOf(p, x))))) {
    const from = { ...posOf(p, u) }, to = aside(p, from, cells);
    if (!to) return false;
    ev.push({ t: p.time, type: 'move', src: u.id, from, to: { ...to } }); entOf(p, u.id)!.pos = to; u.order = null;
  }
  open(p, mod);
  // the lab's cell is the clone printer's: everything that reads it follows the move
  if (id === 'lab' && p.cloner) { p.cloner.x = at.x; p.cloner.y = at.y; mod.at = p.cloner; } else mod.at = { ...at };
  close(p, mod);
  return true;
}

/** A blow lands on a module; at nothing it breaks (it stands as a wreck: in the way, doing nothing). Returns whether it broke. */
export function damageModule(m: Module, n: number): boolean {
  if (m.broken) return false;
  m.hp = Math.max(0, m.hp - n);
  if (m.hp > 0) return false;
  m.broken = true;
  return true;
}
/** what mending a module costs: an ore for every six points missing */
export const moduleRepairCost = (m: Module): number => Math.ceil((MODULE_HP - m.hp) / 6);
export function repairModule(p: WorldParty, id: ModuleId): boolean {
  const m = moduleOf(p, id), cost = m ? moduleRepairCost(m) : 0;
  if (!m || !cost || p.ore < cost || p.raid) return false;
  p.ore -= cost; m.hp = MODULE_HP; m.broken = false;
  return true;
}

/**
 * What the modules can be given (spec §3). `gather` and `medical` are functions that start switched off; the rest are steps.
 * Each row: the module it belongs to, and what each next step costs (ore, crystal).
 */
export const UPGRADES = {
  /** the core: clones left at home work the wreck — each brings a little ore and bio-matter per trip down */
  gather: { module: 'core', cost: [[40, 0]] },
  /** the lab: clones come home healed, and a raid leaves nobody injured */
  medical: { module: 'lab', cost: [[60, 5]] },
  /** the quarters: one more clone per bed (two to begin with) */
  beds: { module: 'quarters', cost: [[30, 0], [50, 0], [80, 5], [120, 10]] },
  /** the workshop: eight more barricades a step */
  stock: { module: 'workshop', cost: [[30, 0], [50, 0], [80, 5]] },
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
  return !!cost && !p.raid && home(p, id) && p.ore >= cost[0] && p.crystal >= cost[1];
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
export const GATHER = { ore: 3, bio: 2 };
/** A trip down is over: what the clones that stayed brought in meanwhile (null: nothing; the caller adds it to the stores). */
export function gatherHome(p: WorldParty, stayed: number): { ore: number; bio: number } | null {
  if (!upgradeOn(p, 'gather') || stayed <= 0) return null;
  return { ore: GATHER.ore * stayed, bio: GATHER.bio * stayed };
}
