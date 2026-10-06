import { raidTurn, towerTick } from '../base/raidAi';
import { resolveRaid, type Raid } from '../base/raids';
import type { Building } from '../base/buildings';
import { G, starterGear, nextItemId } from '../delve/gear';
import { newState } from '../grid/state';
import { dist, idx, type Cell, type GEvent } from '../grid/types';
import { entOf } from '../party/partyCore';
import { CLASSES, FOES, type FoeId } from '../party/partyDefs';
import { tick } from '../party/partySim';
import { blank, hpNow, living, look, roamStep, type RoamParty } from '../roam/roam';
import { COVER, generateWorld, type Camp, type Ground, type LandLight, type World } from './worldGen';

export { clones, MAX_CLONES, orderTo } from '../roam/roam';
export const SIGHT = 9;
const CLAIM_BASE = 11;
const CLAIM_CAMP = 9;

export interface WorldParty extends RoamParty { ground: Ground[]; camps: Camp[]; claimed: Uint8Array; lights: LandLight[];
  /** the drill rig over the shaft down (the pod's landing ground) */
  drill?: Cell;
  drillLevel: number; buildings: Building[]; nextBuilding: number;
  trips: number; raidClock: number | null; raidsDone: number; deepest: number; podHp: number; raid: Raid | null; away: boolean; baseEvents: GEvent[];
  pod?: boolean }

const FOE_OF: Record<string, FoeId> = { minion: 'goblin', archer: 'archer', brute: 'brute' };

/** One empty clone wakes by the crashed ship; the land round it is unknown, its camps asleep, souls lying about. */
export function newWorld(seed = 1): WorldParty { return fromWorld(generateWorld(seed), seed); }

/** Where the pod came down: one empty clone steps out beside it; the drill rig waits next to the pod. */
export function newSurface(seed = 1): WorldParty { return fromWorld(generateWorld(seed, { pod: true }), seed); }

function fromWorld(w: World, seed: number): WorldParty {
  const m = w.map;
  const s = newState(m, seed, 'pistol', 1);
  s.hero.hp = s.hero.maxHp = CLASSES.shell.hp; s.hero.awake = false;
  const p: WorldParty = { s, units: [], time: 0, wave: 0, combat: false, leader: 'hero', roam: true, sight: SIGHT, ground: w.ground, camps: w.camps, base: w.base, claimed: new Uint8Array(m.w * m.h), souls: w.souls, lights: w.lights, ore: 0, crystal: 0, foundHeroes: [], carried: [], pack: [{id:'item-1',consumable:'potion'},{id:'item-2',consumable:'potion'}], nextItem: 3, nextClone: 1, bio: 0, printHere: true, cover: Uint8Array.from(w.ground, (g) => (COVER.has(g) ? 1 : 0)), trips: 0, raidClock: null, raidsDone: 0, deepest: 1, podHp: 200, raid: null, away: false, baseEvents: [], buildings: [], nextBuilding: 1, drillLevel: 0, drill: w.drill, pod: w.pod };
  p.units.push({ ...blank(), id: 'hero', side: 'hero', cls: 'shell', weapon: 'fists', gear: starterGear('shell', () => nextItemId(p)) });
  s.foes.forEach((e, i) => {
    const sp = m.spawns[i]!, camp = w.camps.find((c) => c.group === sp.group);
    const kind = FOE_OF[e.kind] ?? 'goblin';
    // strays are a little weaker than camp goblins; camps grow tougher ring by ring
    const scale = camp ? 1 + 0.35 * (camp.tier - 1) : 0.8;
    e.hp = e.maxHp = Math.round(FOES[kind].hp * scale * (sp.elite ? 1.5 : 1));
    p.units.push({ ...blank(), id: e.id, side: 'foe', foe: kind, asleep: true, group: sp.group, nextAt: 0.15 * i });
  });
  p.foeAction = (u, t, ev) => raidTurn(p, u, t, ev);
  claim(p, w.base, CLAIM_BASE);
  look(p);
  return p;
}

export function claim(p: WorldParty, c: Cell, r: number): void {
  const m = p.s.map;
  for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h || Math.hypot(x - c.x, y - c.y) > r) continue;
    p.claimed[y * m.w + x] = 1;
  }
}

/** Time runs on the world map: the clones act, then the roaming rules (souls, sight, waking, chases), cleared camps, and rest on claimed land. */
export function worldTick(p: WorldParty, dt: number): GEvent[] {
  if (p.away) return [];
  if (p.raid && !living(p).length) { p.over = false; p.waiting = false; p.manual = undefined; }
  const pending = p.baseEvents.splice(0);
  const t0 = p.time, hp = hpNow(p);
  const ev = tick(p, dt);
  ev.unshift(...pending);
  towerTick(p, ev);
  resolveRaid(p, ev);
  // Delay the ordinary wipe/respawn rules until an unattended raid resolves.
  if (!p.raid || living(p).length) roamStep(p, hp, ev);
  if (!living(p).length) return ev;
  const t = p.time;
  for (const camp of p.camps) {
    if (camp.cleared || p.units.some((f) => f.side === 'foe' && f.group === camp.group && entOf(p, f.id)!.alive)) continue;
    camp.cleared = true;
    claim(p, camp.pos, CLAIM_CAMP);
    ev.push({ t, type: 'buff', src: p.leader, dst: p.leader, text: 'claim', amount: camp.id });
  }
  // claimed land heals: 2% of health per second out of combat
  if (!p.combat) for (const u of living(p)) {
    const e = entOf(p, u.id)!;
    if (!p.claimed[idx(p.s.map, e.pos)]) continue;
    const ticks = Math.floor(t * 2) - Math.floor(t0 * 2);
    if (ticks > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + Math.max(1, Math.round(e.maxHp * 0.01 * ticks * G.healTaken(u))));
  }
  return ev;
}

export const claimedShare = (p: WorldParty): number => p.claimed.reduce((a, b) => a + b, 0) / p.claimed.length;

/** The whole living party stands by the drill rig and nothing hunts it: they can go down the shaft. */
export const canDrill = (p: WorldParty): boolean => !!p.drill && !p.away && !p.raid && !p.combat && living(p).length > 0 && living(p).every((u) => dist(entOf(p, u.id)!.pos, p.drill!) <= 2);
