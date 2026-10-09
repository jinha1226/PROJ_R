import { dist, idx, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, damage, entOf, type Unit } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';
import { domeUp, hitDome } from './siege';
import { inDome, rimOf, siegeField } from './siegePath';

/** fodder: weak, many; they move about a cell a turn and strike once a turn */
const FODDER_DMG: [number, number] = [1, 3], SPEED = 1.1, REACH = 0.42, STEP = 0.1;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** a cell a fodder cannot stand in: off the map, rock and trees, a module, the ground under the dome while it stands */
function blocked(p: WorldParty, up: boolean, x: number, y: number): boolean {
  const c = { x: Math.floor(x), y: Math.floor(y) };
  if (c.x < 0 || c.y < 0 || c.x >= p.s.map.w || c.y >= p.s.map.h) return true;
  return !walkable(tileAt(p.s.map, c)) || (up && inDome(p, c));
}

/** a fodder's blow: a clone beside it out in the open (the dome shelters those inside), else the dome when it stands at its rim */
function strikeNear(p: WorldParty, u: Unit, cell: Cell, atRim: boolean, heroes: Unit[], ev: GEvent[]): boolean {
  const t = p.time, hit = () => Math.max(1, Math.round(p.s.rng.int(FODDER_DMG[0], FODDER_DMG[1]) * (u.foeScale ?? 1)));
  const hero = heroes.find((h) => alive(p, h) && dist(entOf(p, h.id)!.pos, cell) <= 1);
  if (hero) { damage(p, t, u.id, hero, hit(), ev, false, false, 'physical', true); return true; }
  if (atRim) { hitDome(p, Math.max(1, Math.round(u.foeScale ?? 1)), u.id, cell, ev); return true; }
  return false;
}

/** One small step of the whole horde: each fodder steers down the field to the dome's rim, is pushed off its neighbours, and strikes what it reaches. */
function step(p: WorldParty, dt: number, ev: GEvent[]): void {
  const m = p.s.map, field = siegeField(p), rim = rimOf(p), up = domeUp(p), crowd = new Map<number, Unit[]>();
  const live = p.units.filter((u) => u.swarm && alive(p, u));
  // the clones out in the open can be struck; the dome shelters the ones under it
  const heroes = p.units.filter((u) => u.side === 'hero' && alive(p, u) && !(up && inDome(p, entOf(p, u.id)!.pos)));
  for (const u of live) { const k = Math.floor(u.sy!) * m.w + Math.floor(u.sx!); const l = crowd.get(k); if (l) l.push(u); else crowd.set(k, [u]); }
  for (const u of live) {
    const e = entOf(p, u.id)!, cx = Math.floor(u.sx!), cy = Math.floor(u.sy!), k0 = idx(m, { x: cx, y: cy }), at = field[k0] ?? -1, here = at < 0 ? Infinity : at;
    // down the field: a pull toward each neighbour nearer the rim
    let gx = 0, gy = 0, best: Cell | null = null, bestD = here;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const d = field[idx(m, { x: nx, y: ny })]!;
      if (d < 0 || !(d < here)) continue;
      const l = Math.hypot(dx, dy); gx += (dx / l) * (here - d); gy += (dy / l) * (here - d);
      if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
    }
    const atRim = rim.has(k0);
    if (p.time >= (u.hitAt ?? 0) && strikeNear(p, u, { x: cx, y: cy }, atRim, heroes, ev)) u.hitAt = p.time + 1;
    let vx = 0, vy = 0;
    const gl = Math.hypot(gx, gy);
    if (gl > 0 && !atRim) { vx = (gx / gl) * SPEED; vy = (gy / gl) * SPEED; }
    // pulls that cancel out (a rock between two equal ways) or a fodder that has stood still a while: head for the nearest cell's middle
    if (!atRim && best && (gl < 0.35 || (u.stillT ?? 0) > 0.6)) {
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
    if (!blocked(p, up, nx, u.sy!)) u.sx = nx;
    if (!blocked(p, up, u.sx!, ny)) u.sy = ny;
    // how long it has stood (nearly) still away from the rim: the watchdog above reads it
    u.stillT = atRim || Math.hypot(u.sx! - ox, u.sy! - oy) > SPEED * dt * 0.25 ? 0 : (u.stillT ?? 0) + dt;
    e.pos = { x: Math.floor(u.sx!), y: Math.floor(u.sy!) };
  }
}

/** Time runs on for the horde: the fodder move in small steps. */
export function swarmTick(p: WorldParty, dt: number, ev: GEvent[]): void {
  if (!p.siege) return;
  for (let left = dt; left > 1e-6; left -= STEP) step(p, Math.min(STEP, left), ev);
}
