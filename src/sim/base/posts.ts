import { idx, same, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { entOf, occupied, unitOf, type Unit } from '../party/partyCore';
import { living } from '../roam/roam';
import type { WorldParty } from '../overworld/worldSim';
import { buildingsAt } from './buildings';
import { resetRaidPath } from './raidPath';

/**
 * Posts (spec 2026-10-09 §2.1): by day each clone is given the cell it will hold when a raid comes. In the raid it stands
 * there and never leaves — it is a wall tile that fights.
 */
export function canPost(p: WorldParty, id: string, at: Cell): boolean {
  const m = p.s.map, u = unitOf(p, id);
  if (!u || u.side !== 'hero' || u.summoner || p.raid) return false;
  if (at.x < 0 || at.y < 0 || at.x >= m.w || at.y >= m.h || !p.claimed[idx(m, at)] || !walkable(tileAt(m, at)) || buildingsAt(p, at)) return false;
  return !p.units.some((o) => o.id !== id && o.post && same(o.post, at));
}

/** Gives the clone its post (it walks there at once); the same cell again takes the post away. */
export function setPost(p: WorldParty, id: string, at: Cell): boolean {
  const u = unitOf(p, id);
  if (u?.post && same(u.post, at) && !p.raid) { u.post = undefined; u.order = null; return true; }
  if (!u || !canPost(p, id, at)) return false;
  u.post = { ...at }; u.order = { kind: 'move', cell: { ...at } }; u.idleAt = 0;
  return true;
}

/** a free open cell at or round `at` */
function near(p: WorldParty, u: Unit, at: Cell): Cell | undefined {
  for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const c = { x: at.x + dx, y: at.y + dy };
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(tileAt(p.s.map, c)) && !occupied(p, c, u.id)) return c;
  }
  return undefined;
}

/** The raid begins: every clone stands on its post (or where it is, with none) and holds it for the whole raid. */
export function takePosts(p: WorldParty, ev: GEvent[]): void {
  for (const u of living(p)) {
    const e = entOf(p, u.id)!;
    const at = u.post && !same(e.pos, u.post) ? near(p, u, u.post) : undefined;
    if (at) { ev.push({ t: p.time, type: 'move', src: u.id, from: { ...e.pos }, to: { ...at }, text: 'post' }); e.pos = at; }
    u.order = { kind: 'hold', cell: { ...e.pos }, fixed: true };
  }
  resetRaidPath(p);
}
