import type { Vec2 } from '../../core/vec2';
import { createState } from '../battle/setup';
import type { UnitState } from '../battle/types';
import { heroSetup } from '../extract/heroSetup';
import type { Stack } from '../extract/inventory';
import { emptyLoadout, partyPack, settleCapacity, speedMult, type Loadout } from '../extract/loadout';
import type { Region } from '../extract/regionTypes';
import type { Mercenary } from '../roster/types';
import { NavGrid } from './nav';
import { worldEnemy } from './soloScale';
import type { Group, WorldState } from './types';
import { emitW } from './worldState';

export interface Member { merc: Mercenary; gear: Loadout }

/** Spawn points around the start, nearest first (behind the leader). */
const RING: Vec2[] = [{ x: 0, y: 0 }, { x: -1.4, y: -1 }, { x: -1.4, y: 1 }, { x: -2.6, y: -1.6 }, { x: -2.6, y: 1.6 }, { x: -3.6, y: 0 }];

function freeAround(nav: NavGrid, c: Vec2, taken: Vec2[]): Vec2 {
  for (let r = 0; r < 8; r += 0.7)
    for (let a = 0; a < 12; a++) {
      const p = { x: c.x + Math.cos((a / 12) * Math.PI * 2) * r, y: c.y + Math.sin((a / 12) * Math.PI * 2) * r };
      if (nav.walkable(p) && !taken.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 1)) return p;
    }
  return c;
}

/** A sortie with a party: members around the start (leader first), every guard asleep where the region put them. */
export function createPartyWorld(region: Region, members: Member[], pack: Stack[], pouch: Stack | null, seed: number, quick: (Stack | null)[] = []): WorldState {
  const nav = new NavGrid(region.bounds, region.obstacles);
  const gear = Object.fromEntries(members.map((m) => [m.merc.id, { ...emptyLoadout(), equipped: { ...m.gear.equipped } }]));
  const packLoadout = partyPack(Object.values(gear), pack, pouch, quick);
  const into = { x: Math.sign(-region.start.x) || 1, y: 0 };
  const taken: Vec2[] = [];
  const allies = members.map((m, i) => {
    const off = RING[i] ?? RING[RING.length - 1]!;
    const spawn = freeAround(nav, { x: region.start.x + off.x * into.x, y: region.start.y + off.y }, taken);
    taken.push(spawn);
    return { ...heroSetup(m.merc, gear[m.merc.id]!, speedMult(packLoadout)), id: m.merc.id, spawn, facing: into.x > 0 ? 0 : Math.PI, controlled: true, isLeader: i === 0 };
  });
  const enemies = region.spawns.map((s, i) => ({ ...worldEnemy(s.enemyId, s.stage, i), id: s.id, spawn: { ...s.pos }, facing: Math.PI * ((i * 0.37) % 2), controlled: true }));
  const b = createState({ seed, allies, enemies, obstacles: region.obstacles, bounds: region.bounds, mode: 'world' });
  for (const u of b.units) if (u.team === 'enemy') u.dormant = true;
  const groups: Record<string, Group> = {};
  for (const s of region.spawns) (groups[s.group] ??= { alerted: false, home: { ...s.pos }, members: [] }).members.push(s.id);
  const leader = members[0]!.merc;
  return {
    seed, b, region, nav, heroId: leader.id, groups,
    ai: Object.fromEntries(region.spawns.map((s) => [s.id, { mode: s.patrol ? 'patrol' : 'idle', wp: 0, home: { ...s.pos }, repathIn: 0 }])),
    groupOf: Object.fromEntries(region.spawns.map((s) => [s.id, s.group])),
    routes: Object.fromEntries(region.spawns.filter((s) => s.patrol).map((s) => [s.id, s.patrol!])),
    containers: {}, piles: [], doorsOpen: [], closed: [], events: [], outcome: null, xp: 0, nextSpawn: 0,
    party: { order: members.map((m) => m.merc.id), mercs: Object.fromEntries(members.map((m) => [m.merc.id, m.merc])), gear, mode: 'explore', calmTicks: 0, trail: [], dead: [], follow: {} },
    hero: { merc: leader, loadout: packLoadout, poisonImmuneUntil: 0, hiddenUntil: 0, lastHp: allies[0]!.stats.maxHp, lastCombat: -1e9 },
  };
}

/** Living members (standing or down), in party order. */
export function partyUnits(w: WorldState): UnitState[] {
  return w.party.order.map((id) => w.b.units.find((u) => u.id === id)).filter((u): u is UnitState => !!u && u.alive);
}

/** The next standing member takes the lead when the leader falls. */
export function updateLeader(w: WorldState): void {
  const lead = w.b.units.find((u) => u.id === w.heroId);
  if (lead?.alive && !lead.downed) return;
  const next = partyUnits(w).find((u) => !u.downed);
  if (!next || next.id === w.heroId) return;
  w.heroId = next.id;
  w.hero.merc = w.party.mercs[next.id]!;
  w.hero.lastHp = next.hp;
  emitW(w, 'leader', { id: next.id });
}

/** Re-derives pack capacity (from living members' bags) and every member's stats (gear, pack weight). */
export function refreshParty(w: WorldState): { dropped: Stack[] } {
  const alive = partyUnits(w);
  const pack = w.hero.loadout;
  const settled = settleCapacity(partyPack(alive.map((u) => w.party.gear[u.id]!), pack.bag, pack.pouch, pack.quick));
  w.hero.loadout = { ...settled.loadout, quick: pack.quick };
  const speed = speedMult(w.hero.loadout);
  for (const u of alive) {
    const next = { ...heroSetup(w.party.mercs[u.id]!, w.party.gear[u.id]!, speed), id: u.id, controlled: u.setup.controlled, spawn: u.setup.spawn, isLeader: u.id === w.heroId };
    u.setup = next;
    u.maxHp = next.stats.maxHp;
    u.hp = Math.min(u.hp, u.maxHp);
  }
  return { dropped: settled.dropped };
}
