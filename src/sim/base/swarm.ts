import { spawnFoe } from '../grid/foes';
import { dist, idx, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, damage, entOf, type Unit } from '../party/partyCore';
import { FOES, type FoeId } from '../party/partyDefs';
import { blank } from '../roam/roam';
import type { WorldParty } from '../overworld/worldSim';
import { breakBuilding, buildingsAt } from './buildings';
import { blocks, podReach, raidField, resetRaidPath } from './raidPath';

/** one raider waiting to come out at the edge: fodder (the horde), an elite, or the general */
export interface RaidSpawn { at: number; kind: 'fodder' | 'brute' | 'archer' | 'general'; cell: Cell }

/** fodder: weak, many; they move about a cell a turn, strike once a turn */
const FODDER_HP = 10, FODDER_DMG: [number, number] = [2, 4], SPEED = 1.1, REACH = 0.42, STEP = 0.1;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** Raid waves (spec 2026-10-08 §4): three waves ten turns apart, each pouring out over three turns from the open edges; about a tenth elites, the general last. */
export function planWaves(p: WorldParty, total: number, cells: Cell[], t0: number): RaidSpawn[] {
  const out: RaidSpawn[] = [], per = Math.ceil(total / 3);
  for (let k = 0; k < total; k++) {
    const wave = Math.floor(k / per), i = k % per, last = k === total - 1;
    const kind: RaidSpawn['kind'] = last ? 'general' : i % 10 === 9 ? (wave % 2 ? 'archer' : 'brute') : 'fodder';
    out.push({ at: t0 + wave * 10 + (i / per) * 3, kind, cell: cells[(k * 7) % cells.length]! });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** A raider steps out: fodder are swarm units (their own coordinates, no turns); elites and the general fight on the grid. */
export function spawnRaider(p: WorldParty, s: RaidSpawn, ev: GEvent[]): void {
  const group = p.raid!.group, foe: FoeId = s.kind === 'fodder' ? 'goblin' : s.kind === 'general' ? 'warlord' : s.kind;
  const e = spawnFoe(p.s, s.kind === 'fodder' ? 'minion' : s.kind === 'general' ? 'champion' : s.kind, { ...s.cell }, true);
  e.group = group;
  e.hp = e.maxHp = s.kind === 'fodder' ? FODDER_HP : FOES[foe].hp;
  const u: Unit = { ...blank(), id: e.id, side: 'foe', foe, asleep: false, alertUntil: Infinity, group, nextAt: p.time };
  if (s.kind === 'fodder') { e.swarm = true; Object.assign(u, { swarm: true, fodder: true, nextAt: Infinity, sx: s.cell.x + 0.5, sy: s.cell.y + 0.5 }); }
  p.units.push(u);
  ev.push({ t: p.time, type: 'summon', dst: e.id, to: { ...s.cell } });
}

/** a cell a fodder cannot stand in: off the map, rock and trees, a building that blocks (palisades don't) */
function blocked(p: WorldParty, x: number, y: number): boolean {
  const c = { x: Math.floor(x), y: Math.floor(y) };
  if (c.x < 0 || c.y < 0 || c.x >= p.s.map.w || c.y >= p.s.map.h) return true;
  const b = buildingsAt(p, c);
  return (!!b && blocks(b)) || !walkable(tileAt(p.s.map, c));
}

/** a fodder's blow: a clone beside it, else the pod in reach, else the building it is pressed against */
function strikeNear(p: WorldParty, u: Unit, cell: Cell, toward: Cell | null, ev: GEvent[]): boolean {
  const t = p.time, hit = () => p.s.rng.int(FODDER_DMG[0], FODDER_DMG[1]);
  const hero = p.units.find((h) => h.side === 'hero' && alive(p, h) && dist(entOf(p, h.id)!.pos, cell) <= 1);
  if (hero) { damage(p, t, u.id, hero, hit(), ev, false, false, 'physical', true); return true; }
  if (podReach(p, cell)) { const n = hit(); p.podHp = Math.max(0, p.podHp - n); ev.push({ t, type: 'hit', src: u.id, dst: 'pod', to: { ...p.base }, amount: n }); return true; }
  const b = toward && buildingsAt(p, toward);
  if (b && blocks(b)) {
    b.hp = Math.max(0, b.hp - hit());
    if (b.hp === 0) { breakBuilding(p, b); resetRaidPath(p); ev.push({ t, type: 'die', src: u.id, dst: b.id, to: { ...b.at } }); }
    return true;
  }
  return false;
}

/** One small step of the whole horde: each fodder steers down the field, is pushed off its neighbours, and strikes what stops it. */
function step(p: WorldParty, dt: number, ev: GEvent[]): void {
  const m = p.s.map, field = raidField(p), crowd = new Map<number, Unit[]>();
  const live = p.units.filter((u) => u.swarm && alive(p, u));
  for (const u of live) { const k = Math.floor(u.sy!) * m.w + Math.floor(u.sx!); const l = crowd.get(k); if (l) l.push(u); else crowd.set(k, [u]); }
  for (const u of live) {
    const e = entOf(p, u.id)!, cx = Math.floor(u.sx!), cy = Math.floor(u.sy!), here = field[idx(m, { x: cx, y: cy })] ?? Infinity;
    // down the field: a pull toward each lower neighbour (a wall in the way is lower ground only after its breaking cost)
    let gx = 0, gy = 0, best: Cell | null = null, bestD = here;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const d = field[idx(m, { x: nx, y: ny })]!;
      if (!(d < here)) continue;
      const l = Math.hypot(dx, dy); gx += (dx / l) * (here - d); gy += (dy / l) * (here - d);
      if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
    }
    const atPod = podReach(p, { x: cx, y: cy });
    if (p.time >= (u.hitAt ?? 0) && strikeNear(p, u, { x: cx, y: cy }, best && blocked(p, best.x + 0.5, best.y + 0.5) ? best : null, ev)) u.hitAt = p.time + 1;
    let vx = 0, vy = 0;
    const gl = Math.hypot(gx, gy);
    if (gl > 0 && !atPod) { vx = (gx / gl) * SPEED; vy = (gy / gl) * SPEED; }
    // pushed apart by the crowd round it
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) for (const o of crowd.get((cy + oy) * m.w + cx + ox) ?? []) {
      if (o === u) continue;
      const dx = u.sx! - o.sx!, dy = u.sy! - o.sy!, d = Math.hypot(dx, dy) || 0.01;
      if (d < REACH * 2) { const push = (REACH * 2 - d) * 3; vx += (dx / d) * push; vy += (dy / d) * push; }
    }
    const nx = u.sx! + vx * dt, ny = u.sy! + vy * dt;
    if (!blocked(p, nx, u.sy!)) u.sx = nx;
    if (!blocked(p, u.sx!, ny)) u.sy = ny;
    e.pos = { x: Math.floor(u.sx!), y: Math.floor(u.sy!) };
  }
}

/** Time runs on for the horde: the waiting raiders step out on time, then the fodder move in small steps. */
export function swarmTick(p: WorldParty, dt: number, ev: GEvent[]): void {
  if (!p.raid) return;
  const end = p.time;
  while (p.raidQueue?.length && p.raidQueue[0]!.at <= end) spawnRaider(p, p.raidQueue.shift()!, ev);
  for (let left = dt; left > 1e-6; left -= STEP) step(p, Math.min(STEP, left), ev);
}
