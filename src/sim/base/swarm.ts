import { spawnFoe } from '../grid/foes';
import { dist, idx, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, damage, entOf, type Unit } from '../party/partyCore';
import { FOES, type FoeId } from '../party/partyDefs';
import { blank } from '../roam/roam';
import type { WorldParty } from '../overworld/worldSim';
import { breakBuilding, buildingsAt } from './buildings';
import { blocks, hitTarget, raidField, resetRaidPath, targetNear, targets } from './raidPath';

/** one raider waiting to come out at the edge: fodder (the horde), an elite, or the general; `lean` fodder leave nothing behind */
export interface RaidSpawn { at: number; kind: 'fodder' | 'brute' | 'archer' | 'general'; cell: Cell; lean?: boolean }
/** a raid's make-up: how many come, in how many waves, how often an elite walks among the fodder (0: none), whether the general closes it */
export interface RaidPlan { size: number; waves: number; eliteEvery: number; general: boolean }

/** fodder: weak, many; they move about a cell a turn, strike once a turn */
const FODDER_HP = 6, FODDER_DMG: [number, number] = [1, 3], SPEED = 1.1, REACH = 0.42, STEP = 0.1;
/** the waves: one every WAVE_GAP turns, each pouring out over WAVE_POUR; one fodder in PAY_EVERY leaves something behind */
export const WAVE_GAP = 40, WAVE_POUR = 24, PAY_EVERY = 10;
/** how many fodder blows one structure (the pod, a module) takes in a turn at most (the rest of the crowd cannot get at it) */
export const BLOWS = 12;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** Raid waves (spec 2026-10-09 §2.4): the horde in waves from the open edges, elites walking among it, the general last. */
export function planWaves(plan: RaidPlan, cells: Cell[], t0: number): RaidSpawn[] {
  const out: RaidSpawn[] = [], per = Math.ceil(plan.size / plan.waves);
  for (let k = 0; k < plan.size; k++) {
    const wave = Math.floor(k / per), i = k % per, last = k === plan.size - 1;
    const elite = plan.eliteEvery > 0 && i % plan.eliteEvery === plan.eliteEvery - 1;
    const kind: RaidSpawn['kind'] = last && plan.general ? 'general' : elite ? ((wave + Math.floor(i / plan.eliteEvery)) % 2 ? 'archer' : 'brute') : 'fodder';
    out.push({ at: t0 + wave * WAVE_GAP + (i / per) * WAVE_POUR, kind, cell: cells[(k * 5 + wave) % cells.length]!, ...(kind === 'fodder' && k % PAY_EVERY ? { lean: true } : {}) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** A raider steps out: fodder are swarm units (their own coordinates, no turns); elites and the general fight on the grid. */
export function spawnRaider(p: WorldParty, s: RaidSpawn, ev: GEvent[]): void {
  const group = p.raid!.group, foe: FoeId = s.kind === 'fodder' ? 'goblin' : s.kind === 'general' ? 'warlord' : s.kind;
  const e = spawnFoe(p.s, s.kind === 'fodder' ? 'minion' : s.kind === 'general' ? 'champion' : s.kind, { ...s.cell }, true);
  e.group = group;
  e.hp = e.maxHp = s.kind === 'fodder' ? FODDER_HP : FOES[foe].hp;
  const u: Unit = { ...blank(), id: e.id, side: 'foe', foe, asleep: false, alertUntil: Infinity, group, nextAt: p.time, raider: true, ...(s.lean ? { lean: true } : {}) };
  if (s.kind === 'fodder') { e.swarm = true; Object.assign(u, { swarm: true, fodder: true, nextAt: Infinity, sx: s.cell.x + 0.5, sy: s.cell.y + 0.5 }); }
  p.units.push(u);
  ev.push({ t: p.time, type: 'summon', dst: e.id, to: { ...s.cell } });
}

/** a cell a fodder cannot stand in: off the map, rock and trees, a barricade, a cell a clone (or its summon) stands on */
function blocked(p: WorldParty, solid: Set<number>, x: number, y: number): boolean {
  const c = { x: Math.floor(x), y: Math.floor(y) };
  if (c.x < 0 || c.y < 0 || c.x >= p.s.map.w || c.y >= p.s.map.h) return true;
  return solid.has(idx(p.s.map, c)) || !walkable(tileAt(p.s.map, c));
}

/** a fodder's blow: a clone beside it, else the pod or a module in reach, else the barricade it is pressed against */
function strikeNear(p: WorldParty, u: Unit, cell: Cell, toward: Cell | null, heroes: Unit[], ev: GEvent[]): boolean {
  const t = p.time, hit = () => p.s.rng.int(FODDER_DMG[0], FODDER_DMG[1]);
  const hero = heroes.find((h) => alive(p, h) && dist(entOf(p, h.id)!.pos, cell) <= 1);
  if (hero) { damage(p, t, u.id, hero, hit(), ev, false, false, 'physical', true); return true; }
  // what we built is thick-skinned: a fodder chips a point off it, and only the front rank lands its blows (BLOWS a turn
  // on each structure) — a leak is a countdown the player can answer, not a sudden end
  const target = targetNear(p, cell);
  if (target) {
    const left = p.blows?.[target] ?? 0;
    if (left < 1) return true;
    p.blows![target] = left - 1;
    hitTarget(p, target, 1, u.id, ev); return true;
  }
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
  // every body on our side holds its cell against the horde (a clone at its post is a wall tile; so is a skeleton while it stands)
  const heroes = p.units.filter((u) => u.side === 'hero' && alive(p, u)), solid = new Set(heroes.map((h) => idx(m, entOf(p, h.id)!.pos)));
  for (const u of live) { const k = Math.floor(u.sy!) * m.w + Math.floor(u.sx!); const l = crowd.get(k); if (l) l.push(u); else crowd.set(k, [u]); }
  for (const u of live) {
    const e = entOf(p, u.id)!, cx = Math.floor(u.sx!), cy = Math.floor(u.sy!), here = field[idx(m, { x: cx, y: cy })] ?? Infinity;
    // down the field: a pull toward each lower neighbour (a walled cell is lower ground only when no open road is left)
    let gx = 0, gy = 0, best: Cell | null = null, bestD = here;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const d = field[idx(m, { x: nx, y: ny })]!;
      if (!(d < here)) continue;
      const l = Math.hypot(dx, dy); gx += (dx / l) * (here - d); gy += (dy / l) * (here - d);
      if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
    }
    const atPod = !!targetNear(p, { x: cx, y: cy });
    if (p.time >= (u.hitAt ?? 0) && strikeNear(p, u, { x: cx, y: cy }, best && blocked(p, solid, best.x + 0.5, best.y + 0.5) ? best : null, heroes, ev)) u.hitAt = p.time + 1;
    let vx = 0, vy = 0;
    const gl = Math.hypot(gx, gy);
    if (gl > 0 && !atPod) { vx = (gx / gl) * SPEED; vy = (gy / gl) * SPEED; }
    // pulls that cancel out (a pillar between two equal ways) or a fodder that has stood still a while: head for the lowest cell's middle
    if (!atPod && best && (gl < 0.35 || (u.stillT ?? 0) > 0.6)) {
      const tx = best.x + 0.5 - u.sx!, ty = best.y + 0.5 - u.sy!, tl = Math.hypot(tx, ty) || 1;
      vx = (tx / tl) * SPEED; vy = (ty / tl) * SPEED;
    }
    // pushed apart by the crowd round it
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) for (const o of crowd.get((cy + oy) * m.w + cx + ox) ?? []) {
      if (o === u) continue;
      const dx = u.sx! - o.sx!, dy = u.sy! - o.sy!, d = Math.hypot(dx, dy) || 0.01;
      if (d < REACH * 2) { const push = (REACH * 2 - d) * 3; vx += (dx / d) * push; vy += (dy / d) * push; }
    }
    const nx = u.sx! + vx * dt, ny = u.sy! + vy * dt, ox = u.sx!, oy = u.sy!;
    if (!blocked(p, solid, nx, u.sy!)) u.sx = nx;
    if (!blocked(p, solid, u.sx!, ny)) u.sy = ny;
    // how long it has stood (nearly) still away from the pod: the watchdog above reads it
    u.stillT = atPod || Math.hypot(u.sx! - ox, u.sy! - oy) > SPEED * dt * 0.25 ? 0 : (u.stillT ?? 0) + dt;
    e.pos = { x: Math.floor(u.sx!), y: Math.floor(u.sy!) };
  }
}

/** Time runs on for the horde: the waiting raiders step out on time, then the fodder move in small steps. */
export function swarmTick(p: WorldParty, dt: number, ev: GEvent[]): void {
  if (!p.raid) return;
  const end = p.time;
  while (p.raidQueue?.length && p.raidQueue[0]!.at <= end) spawnRaider(p, p.raidQueue.shift()!, ev);
  const blows = (p.blows ??= {});
  for (const t of targets(p)) blows[t.id] = Math.min(BLOWS, (blows[t.id] ?? BLOWS) + BLOWS * dt);
  for (let left = dt; left > 1e-6; left -= STEP) step(p, Math.min(STEP, left), ev);
}
