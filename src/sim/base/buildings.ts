import { distanceMap } from '../grid/path';
import { idx, same, tileAt, walkable, type Cell, type GEvent, type GridMap, type Tile } from '../grid/types';
import { alive, entOf, occupied, posOf, type Unit } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';

/**
 * Barricades (spec 2026-10-09 §2.1): the one thing laid on the base's ground. A limited stock, free to lay and to take up
 * by day; a raid may break them and they stand again when it is over. They stop feet, not shots.
 */
export const BARRICADE_HP = 80;
/** the stock: what the base starts with, what each workshop step adds, and the most it can hold */
export const BARRICADE_START = 12, BARRICADE_STEP = 6, BARRICADE_MAX = 36;
export type BuildingKind = 'barricade';
export interface Building { id: string; kind: BuildingKind; at: Cell; hp: number; maxHp: number; original: { tile: Tile; cover: number };
  /** a raid has broken it: it blocks nothing until the raid is over */
  broken?: boolean }

export const barricadeCap = (p: WorldParty): number => Math.min(BARRICADE_MAX, BARRICADE_START + BARRICADE_STEP * (p.barricadeLevel ?? 0));
export const barricadesLeft = (p: WorldParty): number => barricadeCap(p) - p.buildings.length;
export const buildingsAt = (p: WorldParty, at: Cell): Building | undefined => p.buildings.find((b) => same(b.at, at));

/** the cells kept clear by the shaft: clones coming up step out there */
const reserved = (p: WorldParty, c: Cell): boolean => {
  const s = p.s.map.start;
  return (c.y === s.y && (c.x === s.x || c.x === s.x + 1)) || same(c, { x: s.x, y: s.y + 1 });
};

/** a clone standing on the cell by day (it steps aside for a barricade), and the free cell beside it it would step to */
const standing = (p: WorldParty, at: Cell): Unit | undefined => p.units.find((u) => u.side === 'hero' && alive(p, u) && same(posOf(p, u), at));
function aside(p: WorldParty, at: Cell): Cell | undefined {
  for (let r = 1; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const c = { x: at.x + dx, y: at.y + dy };
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(tileAt(p.s.map, c)) && !occupied(p, c, '')) return c;
  }
  return undefined;
}

/**
 * Whether a barricade may go on the cell: by day, on our own open ground, with stock left, on nobody's post (a clone merely
 * standing there steps aside) — and never the last gap: the pod must stay reachable from the land outside by barricades
 * alone (a clone closes what is left).
 */
export function canPlace(p: WorldParty, at: Cell): boolean {
  const m = p.s.map;
  if (p.raid || barricadesLeft(p) <= 0 || !Number.isInteger(at.x) || !Number.isInteger(at.y)) return false;
  if (at.x < 0 || at.y < 0 || at.x >= m.w || at.y >= m.h || !p.claimed[idx(m, at)] || !walkable(tileAt(m, at))) return false;
  if (buildingsAt(p, at) || reserved(p, at) || p.units.some((u) => u.post && same(u.post, at))) return false;
  if (occupied(p, at, '') && !(standing(p, at) && aside(p, at))) return false;
  const trial = { ...m, tiles: [...m.tiles] };
  trial.tiles[idx(m, at)] = 'chasm';
  return podOpen(p, trial);
}

/** The pod can still be walked to from the land outside (over the cells by the shaft, where the clones come up). */
function podOpen(p: WorldParty, trial: GridMap): boolean {
  const m = p.s.map, reach = distanceMap(trial, m.start);
  let ring = false;
  for (let y = p.base.y - 1; y <= p.base.y + 2 && !ring; y++) for (let x = p.base.x - 1; x <= p.base.x + 2; x++) if (reach[idx(m, { x, y })]! >= 0) { ring = true; break; }
  return ring && reach.some((d, k) => d >= 0 && Math.hypot((k % m.w) - p.base.x, Math.floor(k / m.w) - p.base.y) > 12);
}

/** Lays a barricade (a clone standing on the cell steps aside first: `ev` carries its step for the view). */
export function place(p: WorldParty, at: Cell, ev: GEvent[] = []): boolean {
  if (!canPlace(p, at)) return false;
  const u = standing(p, at), to = u && aside(p, at);
  if (u && to) { ev.push({ t: p.time, type: 'move', src: u.id, from: { ...at }, to: { ...to } }); entOf(p, u.id)!.pos = to; u.order = null; }
  const k = idx(p.s.map, at);
  p.buildings.push({ id: `building-${p.nextBuilding++}`, kind: 'barricade', at: { ...at }, hp: BARRICADE_HP, maxHp: BARRICADE_HP, original: { tile: tileAt(p.s.map, at), cover: p.cover?.[k] ?? 0 } });
  p.s.map.tiles[k] = 'chasm';
  return true;
}

const open = (p: WorldParty, b: Building): void => {
  const k = idx(p.s.map, b.at);
  p.s.map.tiles[k] = b.original.tile;
  if (p.cover) p.cover[k] = b.original.cover;
};

/** Taken up by day: it goes back into the stock. */
export function pickUp(p: WorldParty, id: string): boolean {
  const b = p.buildings.find((x) => x.id === id);
  if (!b || p.raid) return false;
  open(p, b);
  p.buildings.splice(p.buildings.indexOf(b), 1);
  return true;
}

/** A raid breaks it: the cell is open ground until the raid is over. */
export function breakBuilding(p: WorldParty, b: Building): void { b.hp = 0; b.broken = true; open(p, b); }

/** The raid is over: every barricade stands whole again (one a clone is standing on waits, laid flat, until it steps off). */
export function restoreBarricades(p: WorldParty): void {
  for (const b of p.buildings) {
    b.hp = b.maxHp;
    if (!b.broken || occupied(p, b.at, '')) continue;
    b.broken = false;
    p.s.map.tiles[idx(p.s.map, b.at)] = 'chasm';
  }
}

/** the pod's full health, and what mending it costs (an ore for every six points) */
export const POD_MAX = 600;
export const podRepairCost = (p: WorldParty): number => Math.ceil((POD_MAX - p.podHp) / 6);
export function repairPod(p: WorldParty): boolean {
  const cost = podRepairCost(p);
  if (!cost || p.ore < cost) return false;
  p.ore -= cost; p.podHp = POD_MAX; return true;
}
