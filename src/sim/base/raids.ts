import { spawnFoe } from '../grid/foes';
import { dist, idx, walkable, tileAt, type Cell, type GEvent } from '../grid/types';
import { alive, entOf, posOf } from '../party/partyCore';
import { FOES, type FoeId } from '../party/partyDefs';
import { blank, living } from '../roam/roam';
import { connect } from '../overworld/worldGen';
import type { WorldParty } from '../overworld/worldSim';
import { onReturn, removeBuilding } from './buildings';
import { unitPower } from './power';
import { resetRaidPath } from './raidPath';

export interface Raid { group: number; size: number }
export interface RaidLosses { ore: number; crystal: number; buildings: string[] }
/** Each goblin/archer contributes 10 threat, each brute 20. */
export const raidSize = (p: WorldParty): number => 10 * (3 + p.raidsDone * 2 + Math.floor((p.deepest - 1) / 3));
export const defencePower = (p: WorldParty): number => living(p).filter(u => dist(posOf(p, u), p.base) <= 6).reduce((n, u) => n + unitPower(p, u), 0)
  + p.buildings.reduce((n, b) => n + (b.kind === 'watchtower' ? 15 : b.kind === 'wall' ? 1 : 0), 0);

/** Count completed trips, heal, and advance the return-only raid clock. */
export function onRaidReturn(p: WorldParty, deepest = p.deepest): GEvent[] {
  p.away = false; p.trips++; p.deepest = Math.max(p.deepest, deepest); onReturn(p);
  if (p.raid) return [];
  if (p.raidClock === null) { if (p.trips >= 4 || p.drillLevel > 0) p.raidClock = 0; return []; }
  p.raidClock++;
  if (p.raidClock % 2 === 1) return [{ t: p.time, type: 'buff', text: 'raidSoon', amount: raidSize(p) }];
  // the night has come: the edges are chosen now (so they can be shown), the wave waits for the player to start it
  p.raidReady = { size: raidSize(p), sides: p.s.rng.shuffle([0, 1, 2, 3]).slice(0, p.s.rng.int(1, 2)) };
  return [{ t: p.time, type: 'buff', text: 'raidReady', amount: p.raidReady.size }];
}
/** Open connected entry cells on one or two opposing edges of the generated rock border. */
export function startRaid(p: WorldParty): GEvent[] {
  if (p.away || p.raid) return [];
  const size = raidSize(p), group = 1000 + p.raidsDone, m = p.s.map;
  const sides = p.raidReady?.sides ?? p.s.rng.shuffle([0, 1, 2, 3]).slice(0, p.s.rng.int(1, 2));
  p.raidReady = null;
  const cells: Cell[] = [];
  for (const side of sides) for (let off = -2; off <= 2; off++) {
    const c = side === 0 ? { x: 0, y: p.base.y + off } : side === 1 ? { x: m.w - 1, y: p.base.y + off } : side === 2 ? { x: p.base.x + off, y: 0 } : { x: p.base.x + off, y: m.h - 1 };
    m.tiles[idx(m, c)] = 'floor'; p.ground[idx(m, c)] = 'dirt'; cells.push(c);
  }
  connect(m, p.ground, cells);
  resetRaidPath(p);
  const free = p.s.rng.shuffle(cells.filter(c => walkable(tileAt(m, c))));
  const ev: GEvent[] = []; p.raid = { group, size };
  for (const b of p.buildings) b.nextAt = p.time;
  let remaining = size, i = 0;
  while (remaining > 0) {
    const kind: FoeId = remaining >= 20 && i % 3 === 2 ? 'brute' : i % 3 === 1 ? 'archer' : 'goblin';
    const at = free[i % free.length]!;
    const e = spawnFoe(p.s, kind === 'goblin' ? 'minion' : kind, { ...at }, true);
    e.hp = e.maxHp = FOES[kind].hp; e.group = group;
    p.units.push({ ...blank(), id: e.id, side: 'foe', foe: kind, asleep: false, alertUntil: Infinity, group, nextAt: p.time + i * .15 });
    ev.push({ t: p.time, type: 'summon', dst: e.id, to: { ...at } }); remaining -= kind === 'brute' ? 20 : 10; i++;
  }
  p.combat = true; p.over = false;
  return ev;
}
function finish(p: WorldParty, won: boolean, ev: GEvent[]): RaidLosses {
  const losses: RaidLosses = { ore: 0, crystal: 0, buildings: [] };
  if (!won) {
    losses.ore = Math.floor(p.ore * .3); losses.crystal = Math.floor(p.crystal * .3);
    p.ore -= losses.ore; p.crystal -= losses.crystal;
    losses.buildings = p.s.rng.shuffle(p.buildings).slice(0, p.s.rng.int(1, 2)).map(b => b.id);
    for (const id of losses.buildings) removeBuilding(p, id);
    p.podHp = 100;
  }
  for (const u of p.units) if (u.side === 'foe' && u.group === p.raid?.group) { const e = entOf(p, u.id)!; if (e.alive) u.reaped = true; e.alive = false; e.hp = 0; }
  p.raid = null; p.raidsDone++; p.combat = false;
  ev.push({ t: p.time, type: won ? 'buff' : 'dead', text: won ? 'raidWon' : 'raidLost' });
  return losses;
}
export function resolveRaid(p: WorldParty, ev: GEvent[]): void {
  if (!p.raid) return;
  if (p.podHp <= 0) finish(p, false, ev);
  else if (!p.units.some(u => u.side === 'foe' && u.group === p.raid!.group && alive(p, u))) finish(p, true, ev);
}
export function autoDefend(p: WorldParty, ev: GEvent[] = []): { won: boolean; losses: RaidLosses } | null {
  if (p.away || !p.raid || p.podHp <= 0 || defencePower(p) < p.raid.size * 1.2) return null;
  return { won: true, losses: finish(p, true, ev) };
}
