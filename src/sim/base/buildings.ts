import { distanceMap } from '../grid/path';
import { idx, same, tileAt, walkable, type Cell, type Tile } from '../grid/types';
import { occupied, posOf } from '../party/partyCore';
import { living } from '../roam/roam';
import { claim, type WorldParty } from '../overworld/worldSim';

export const BUILDINGS = {
  watchtower: { size: 1, ore: 20, bio: 0, hp: 60 },
  wall: { size: 1, ore: 1, bio: 0, hp: 40 },
  palisade: { size: 1, ore: 1, bio: 0, hp: 25 },
  gate: { size: 1, ore: 3, bio: 0, hp: 50 },
  infirmary: { size: 2, ore: 40, bio: 10, hp: 100 },
  forge: { size: 2, ore: 40, bio: 0, hp: 100 },
} as const;
export type BuildingKind = keyof typeof BUILDINGS;
export interface Building { id: string; kind: BuildingKind; at: Cell; hp: number; maxHp: number; original: { tile: Tile; cover: number }[]; nextAt: number }
export function footprint(kind: BuildingKind, at: Cell): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < BUILDINGS[kind].size; y++) for (let x = 0; x < BUILDINGS[kind].size; x++) out.push({ x: at.x + x, y: at.y + y });
  return out;
}
export const buildingsAt = (p: WorldParty, at: Cell): Building | undefined => p.buildings.find(b => footprint(b.kind, b.at).some(c => same(c, at)));
const solid = (kind: BuildingKind) => kind !== 'gate' && kind !== 'palisade';

export function canPlace(p: WorldParty, kind: BuildingKind, at: Cell): boolean {
  const def = BUILDINGS[kind], m = p.s.map;
  if (p.ore < def.ore || p.bio < def.bio || !Number.isInteger(at.x) || !Number.isInteger(at.y)) return false;
  const cells = footprint(kind, at);
  if (cells.some(c => c.x < 0 || c.y < 0 || c.x >= m.w || c.y >= m.h || !p.claimed[idx(m, c)] || !walkable(tileAt(m, c)) || occupied(p, c, '') || buildingsAt(p, c)
    // Reserve all three return slots, even while their clones are underground.
    || (c.y === m.start.y && (c.x === m.start.x || c.x === m.start.x + 1)) || same(c, { x: m.start.x, y: m.start.y + 1 }))) return false;
  if (!solid(kind)) return true;
  const trial = { ...m, tiles: [...m.tiles] };
  for (const c of cells) trial.tiles[idx(m, c)] = 'wall';
  const reachable = distanceMap(trial, m.start);
  if (living(p).some(u => reachable[idx(m, posOf(p, u))]! < 0)) return false;
  if (p.drill && ![-1, 1].some(dx => reachable[idx(m, { x: p.drill!.x + dx, y: p.drill!.y })]! >= 0)) return false;
  // A gate or an open gap must always connect the return area to the wider land.
  return reachable.some((d, k) => d >= 0 && Math.hypot(k % m.w - p.base.x, Math.floor(k / m.w) - p.base.y) > 12);
}
export function place(p: WorldParty, kind: BuildingKind, at: Cell): boolean {
  if (!canPlace(p, kind, at)) return false;
  const def = BUILDINGS[kind], cells = footprint(kind, at);
  const b: Building = { id: `building-${p.nextBuilding++}`, kind, at: { ...at }, hp: def.hp, maxHp: def.hp, nextAt: p.time,
    original: cells.map(c => ({ tile: tileAt(p.s.map, c), cover: p.cover?.[idx(p.s.map, c)] ?? 0 })) };
  p.ore -= def.ore; p.bio -= def.bio; p.buildings.push(b);
  for (const c of cells) {
    if (solid(kind)) p.s.map.tiles[idx(p.s.map, c)] = 'wall';
    if (kind === 'palisade' && p.cover) p.cover[idx(p.s.map, c)] = 1;
  }
  if (kind === 'watchtower') claim(p, at, 4);
  return true;
}
/** Destruction restores terrain without a refund. */
export function removeBuilding(p: WorldParty, id: string): boolean {
  const b = p.buildings.find(b => b.id === id);
  if (!b) return false;
  footprint(b.kind, b.at).forEach((c, i) => {
    p.s.map.tiles[idx(p.s.map, c)] = b.original[i]!.tile;
    if (p.cover) p.cover[idx(p.s.map, c)] = b.original[i]!.cover;
  });
  p.buildings.splice(p.buildings.indexOf(b), 1); return true;
}
export function demolish(p: WorldParty, id: string): boolean {
  const b = p.buildings.find(b => b.id === id);
  if (!b) return false;
  p.ore += Math.floor(BUILDINGS[b.kind].ore / 2); p.bio += Math.floor(BUILDINGS[b.kind].bio / 2);
  return removeBuilding(p, id);
}
export function onReturn(p: WorldParty): void {
  if (p.buildings.some(b => b.kind === 'infirmary')) for (const u of living(p)) {
    const e = u.id === 'hero' ? p.s.hero : p.s.foes.find(e => e.id === u.id)!;
    e.hp = e.maxHp;
  }
}
/** Gates first, then towers, then a square radius-four wall ring; preview never mutates p. */
export function recommendedLayout(p: WorldParty): { kind: BuildingKind; at: Cell }[] {
  const candidates: { kind: BuildingKind; at: Cell }[] = [];
  for (const dx of [-4, 4]) candidates.push({ kind: 'gate', at: { x: p.base.x + dx, y: p.base.y } });
  for (const dx of [-3, 3]) candidates.push({ kind: 'watchtower', at: { x: p.base.x + dx, y: p.base.y - 3 } });
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 4 || (dy === 0 && Math.abs(dx) === 4)) continue;
    candidates.push({ kind: 'wall', at: { x: p.base.x + dx, y: p.base.y + dy } });
  }
  let ore = p.ore;
  return candidates.filter(b => { const cost = BUILDINGS[b.kind].ore; if (cost > ore || !canPlace(p, b.kind, b.at)) return false; ore -= cost; return true; });
}
