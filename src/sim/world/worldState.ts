import { createState, enemyFromDef } from '../battle/setup';
import type { UnitState } from '../battle/types';
import { heroSetup } from '../extract/heroSetup';
import type { Loadout } from '../extract/loadout';
import type { Region } from '../extract/regionTypes';
import type { Mercenary } from '../roster/types';
import { NavGrid } from './nav';
import type { Group, WorldState } from './types';

export const HERO_ID = 'hero';

export function unit(w: WorldState, id: string): UnitState {
  const u = w.b.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
}
export const heroUnit = (w: WorldState): UnitState => unit(w, w.heroId);

/** Builds the sortie: the hero at the start, every guard and patrol asleep where the region put them. */
export function createWorld(region: Region, hero: Mercenary, loadout: Loadout, seed: number): WorldState {
  const h = { ...heroSetup(hero, loadout), id: HERO_ID, spawn: { ...region.start }, facing: 0 };
  const enemies = region.spawns.map((s, i) => ({
    ...enemyFromDef(s.enemyId, 2, 0, s.stage, i), id: s.id, spawn: { ...s.pos }, facing: Math.PI * ((i * 0.37) % 2), controlled: true,
  }));
  const b = createState({ seed, allies: [h], enemies, obstacles: region.obstacles, bounds: region.bounds, mode: 'world' });
  for (const u of b.units) if (u.team === 'enemy') u.dormant = true;
  const groups: Record<string, Group> = {};
  for (const s of region.spawns) {
    const g = (groups[s.group] ??= { alerted: false, home: { ...s.pos }, members: [] });
    g.members.push(s.id);
  }
  const ai: WorldState['ai'] = Object.fromEntries(region.spawns.map((s) => [s.id, { mode: s.patrol ? 'patrol' : 'idle', wp: 0, home: { ...s.pos }, repathIn: 0 }]));
  return {
    seed, b, region, nav: new NavGrid(region.bounds, region.obstacles), heroId: HERO_ID, groups, ai,
    groupOf: Object.fromEntries(region.spawns.map((s) => [s.id, s.group])),
    routes: Object.fromEntries(region.spawns.filter((s) => s.patrol).map((s) => [s.id, s.patrol!])),
    containers: {}, piles: [], doorsOpen: [], closed: [], events: [], outcome: null, xp: 0, nextSpawn: 0,
    hero: { merc: hero, loadout, poisonImmuneUntil: 0, hiddenUntil: 0, lastHp: h.stats.maxHp },
  };
}

export function emitW(w: WorldState, type: string, data?: Record<string, unknown>): void {
  w.events.push({ tick: w.b.tick, type, data });
}

/** Switches a unit between world control (unaware) and the battle AI (alert). */
export function setAware(u: UnitState, aware: boolean): void {
  if (!!u.setup.controlled === !aware) return;
  u.setup = { ...u.setup, controlled: !aware };
  if (aware) u.decisionIn = 1;
  u.vel = { x: 0, y: 0 };
}
