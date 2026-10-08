import { dist, idx, walkable, tileAt, type Cell, type GEvent } from '../grid/types';
import { alive, entOf, occupied, posOf } from '../party/partyCore';
import { living } from '../roam/roam';
import { connect } from '../overworld/worldGen';
import type { WorldParty } from '../overworld/worldSim';
import { levelOfBuilding, onReturn, POD_MAX } from './buildings';
import { unitPower } from './power';
import { resetRaidPath } from './raidPath';
import { planWaves, spawnRaider } from './swarm';

/** how far from the pod the horde steps out of the dark */
export const RAID_REACH = 18;
export interface Raid { group: number; size: number }
export interface RaidLosses { ore: number; crystal: number; buildings: string[] }
/** How many come (spec 2026-10-08 §4): 60 at first, more with every raid done and every floor reached, 150 at most. */
export const raidSize = (p: WorldParty): number => Math.min(150, 60 + p.raidsDone * 12 + Math.max(0, p.deepest - 1) * 3);
export const defencePower = (p: WorldParty): number => living(p).filter(u => dist(posOf(p, u), p.base) <= 6).reduce((n, u) => n + unitPower(p, u), 0)
  + p.buildings.filter(b => !b.broken).reduce((n, b) => n + (b.kind === 'watchtower' ? 15 : b.kind === 'shockMine' ? 3 : b.kind === 'wall' ? 1 : 0) * levelOfBuilding(b), 0);

/** Count completed trips, heal, and advance the return-only raid clock. */
export function onRaidReturn(p: WorldParty, deepest = p.deepest): GEvent[] {
  p.away = false; p.trips++; p.deepest = Math.max(p.deepest, deepest); onReturn(p);
  // a trip has gone by: the raid's injured are well again
  for (const u of p.units) if (u.injured) u.injured = false;
  if (p.raid) return [];
  if (p.raidClock === null) { if (p.trips >= 4 || p.drillLevel > 0) p.raidClock = 0; return []; }
  p.raidClock++;
  if (p.raidClock % 2 === 1) return [{ t: p.time, type: 'buff', text: 'raidSoon', amount: raidSize(p) }];
  // the night has come: the edges are chosen now (so they can be shown), the wave waits for the player to start it
  p.raidReady = { size: raidSize(p), sides: p.s.rng.shuffle([0, 1, 2, 3]).slice(0, p.s.rng.int(2, 3)) };
  return [{ t: p.time, type: 'buff', text: 'raidReady', amount: p.raidReady.size }];
}
/** Open connected entry cells on one or two opposing edges of the generated rock border. */
export function startRaid(p: WorldParty): GEvent[] {
  if (p.away || p.raid) return [];
  const size = raidSize(p), group = 1000 + p.raidsDone, m = p.s.map;
  const sides = p.raidReady?.sides ?? p.s.rng.shuffle([0, 1, 2, 3]).slice(0, p.s.rng.int(2, 3));
  p.raidReady = null;
  // the horde comes out of the dark a little beyond the base's ground on each side (spec 2026-10-08 §4), along a seven-cell front
  const cells: Cell[] = [];
  for (const side of sides) for (let off = -3; off <= 3; off++) {
    const c = side === 0 ? { x: p.base.x - RAID_REACH, y: p.base.y + off } : side === 1 ? { x: p.base.x + RAID_REACH, y: p.base.y + off } : side === 2 ? { x: p.base.x + off, y: p.base.y - RAID_REACH } : { x: p.base.x + off, y: p.base.y + RAID_REACH };
    const at = { x: Math.max(1, Math.min(m.w - 2, c.x)), y: Math.max(1, Math.min(m.h - 2, c.y)) };
    m.tiles[idx(m, at)] = 'floor'; p.ground[idx(m, at)] = 'dirt'; cells.push(at);
  }
  connect(m, p.ground, cells);
  resetRaidPath(p);
  const free = p.s.rng.shuffle(cells.filter(c => walkable(tileAt(m, c))));
  const ev: GEvent[] = []; p.raid = { group, size };
  for (const b of p.buildings) b.nextAt = p.time;
  // the horde waits at the edges and pours out in waves (swarm.ts); the first raiders step out at once
  p.raidQueue = planWaves(p, size, free.length ? free : cells, p.time);
  p.raidLoot = { kills: 0, ore: 0, crystal: 0 };
  while (p.raidQueue.length && p.raidQueue[0]!.at <= p.time) spawnRaider(p, p.raidQueue.shift()!, ev);
  p.combat = true; p.over = false;
  return ev;
}
/** The clones downed in the raid rise by the pod at half health, soul and level kept; injured (they skip the next trip) unless an infirmary stands. Returns the injured. */
function raise(p: WorldParty): string[] {
  const ward = p.buildings.some((b) => b.kind === 'infirmary' && b.hp > 0), hurt: string[] = [];
  for (const u of p.units.filter((x) => x.side === 'hero' && !x.summoner)) {
    const e = entOf(p, u.id);
    if (!e || e.alive) continue;
    e.alive = true; e.hp = Math.ceil(e.maxHp / 2);
    e.pos = freeNear(p, p.base) ?? e.pos;
    if (!ward) { u.injured = true; hurt.push(u.id); }
  }
  return hurt;
}
function freeNear(p: WorldParty, at: Cell): Cell | undefined {
  for (let r = 1; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const c = { x: at.x + dx, y: at.y + dy };
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(tileAt(p.s.map, c)) && !occupied(p, c, '')) return c;
  }
  return undefined;
}
function finish(p: WorldParty, won: boolean, ev: GEvent[]): RaidLosses {
  const losses: RaidLosses = { ore: 0, crystal: 0, buildings: [] };
  // a raid costs repairs, never stored materials (spec 2026-10-08 §5): the buildings it broke, and a pod knocked down to a quarter when it fell
  losses.buildings = p.buildings.filter(b => b.broken).map(b => b.id);
  if (!won) p.podHp = Math.max(p.podHp, Math.round(POD_MAX / 4));
  for (const u of p.units) if (u.side === 'foe' && u.group === p.raid?.group) { const e = entOf(p, u.id)!; if (e.alive) u.reaped = true; e.alive = false; e.hp = 0; }
  const loot = p.raidLoot ?? { kills: 0, ore: 0, crystal: 0 };
  p.lastRaid = { won, injured: raise(p), buildings: [...losses.buildings], kills: loot.kills, ore: loot.ore, crystal: loot.crystal };
  p.raidQueue = [];
  p.raid = null; p.raidsDone++; p.combat = false; p.over = false;
  ev.push({ t: p.time, type: won ? 'buff' : 'dead', text: won ? 'raidWon' : 'raidLost' });
  return losses;
}
export function resolveRaid(p: WorldParty, ev: GEvent[]): void {
  if (!p.raid) return;
  // the pod falls, or every clone at the base is down: the raid is lost (never the run)
  if (p.podHp <= 0 || !living(p).length) finish(p, false, ev);
  else if (!p.raidQueue?.length && !p.units.some(u => u.side === 'foe' && u.group === p.raid!.group && alive(p, u))) finish(p, true, ev);
}
export function autoDefend(p: WorldParty, ev: GEvent[] = []): { won: boolean; losses: RaidLosses } | null {
  if (p.away || !p.raid || p.podHp <= 0 || defencePower(p) < p.raid.size * 1.2) return null;
  return { won: true, losses: finish(p, true, ev) };
}
