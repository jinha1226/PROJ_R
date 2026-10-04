import { pickOffer, pickUpgrade } from './build';
import { emergency, fightUtility, utility } from './items';
import { findPath } from '../../../src/sim/grid/path';
import { walkBlocked } from '../../../src/sim/grid/actions';
import type { GridSim } from '../../../src/sim/grid/gridSim';
import { exploreTarget } from '../../../src/sim/grid/explore';
import { dist, idx, same, type Cell, type GridState, type GAction } from '../../../src/sim/grid/types';
import { adjacentFoes, awakeThreats, dangerCells, stepToward } from './view';
import { dodge, tactic } from './tactics';
import { canRegenerate } from '../../../src/sim/grid/regen';

export interface BotMemory { potions: number; scrolls: number; belt: number; upgrades: string[]; notes: string[]; bosses: string[]; chargeWaits: number; retreats: number; mappedFloors: number[]; lootGoal?: { floor: number; pos: Cell }; pursuit?: { floor: number; id: string; pos: Cell }; routeKey?: string; route: number[]; detour?: { floor: number; pos: Cell; steps: number } }
export const createMemory = (): BotMemory => ({ potions: 0, scrolls: 0, belt: 0, upgrades: [], notes: [], bosses: [], chargeWaits: 0, retreats: 0, mappedFloors: [], route: [] });
function decide(sim: GridSim, mem: BotMemory): GAction {
  const s = sim.s, h = s.hero;
  if (s.upgrades.length) return pickUpgrade(s);
  if (s.offers.length) return pickOffer(s);
  if (h.hp > h.maxHp * 0.5) mem.retreats = 0;
  const urgent = emergency(s, mem); if (urgent) return urgent;
  const escape = dodge(s); if (escape) return escape;
  const item = fightUtility(s, mem) ?? utility(s, mem); if (item) return item;
  const combat = tactic(s, mem); if (combat) return combat;
  const nearWave = s.time - s.run.floorStart >= 150 * (s.run.waves + 1) - 20;
  if (!awakeThreats(s).length && h.hp < h.maxHp * 0.85 && canRegenerate(s)
    && !(nearWave && h.hp >= h.maxHp * 0.6)) return { kind: 'wait' };
  const core = s.floorItems.find(f => f.item.kind === 'core');
  const lootable = [...s.floorItems.filter(f => ['potion', 'scroll', 'material', 'suit'].includes(f.item.kind)),
    ...s.chests.filter(c => !c.opened)];
  if (mem.lootGoal && (mem.lootGoal.floor !== s.run.floor || !lootable.some(f => same(f.pos, mem.lootGoal!.pos)))) delete mem.lootGoal;
  if (!awakeThreats(s).length && !mem.lootGoal) {
    const best = lootable.filter(f => s.visible.has(idx(s.map, f.pos)))
      .map(f => ({ pos: f.pos, path: findPath(s.map, h.pos, f.pos, c => walkBlocked(s, c), 12) }))
      .filter(f => f.path?.length).sort((a, b) => a.path!.length - b.path!.length)[0];
    if (best) mem.lootGoal = { floor: s.run.floor, pos: { ...best.pos } };
  }
  // A remembered chest can disappear from sight while rounding its corner.
  const loot = !awakeThreats(s).length && mem.lootGoal ? [mem.lootGoal.pos] : [];
  const goals = [core?.pos, ...loot, s.map.stairs && s.seen[idx(s.map, s.map.stairs)] ? s.map.stairs : undefined,
    exploreTarget(s), ...s.foes.filter(f => f.alive).sort((a, b) => dist(h.pos, a.pos) - dist(h.pos, b.pos)).map(f => f.pos), s.map.stairs];
  for (const g of goals) { const d = g && stepToward(s, g); if (d) return { kind: 'move', dir: d }; }
  return { kind: 'search' };
}

/** Commit to one navigation goal after repeated no-progress movement; combat still interrupts. */
function recoverRoute(s: GridState, mem: BotMemory, action: GAction): GAction {
  const h = s.hero;
  const key = [s.run.floor, s.run.kills, s.floorItems.length, s.chests.filter(c => c.opened).length,
    s.seen.reduce((a, v) => a + v, 0), h.hp, h.charge].join(':');
  if (mem.routeKey !== key) { mem.route = []; mem.routeKey = key; }
  if (mem.detour && (mem.detour.floor !== s.run.floor || same(h.pos, mem.detour.pos) || mem.detour.steps >= 100)) delete mem.detour;
  if (action.kind !== 'move' || adjacentFoes(s).length || dangerCells(s).has(idx(s.map, h.pos)) || h.hp < h.maxHp * 0.5) return action;
  mem.route.push(idx(s.map, h.pos));
  mem.route = mem.route.slice(-16);
  if (!mem.detour && mem.route.filter(k => k === idx(s.map, h.pos)).length >= 3) {
    const core = s.floorItems.find(f => f.item.kind === 'core');
    const goals = [core?.pos, s.map.stairs && s.seen[idx(s.map, s.map.stairs)] ? s.map.stairs : undefined,
      exploreTarget(s), ...s.foes.filter(f => f.alive).sort((a, b) => Number(b.kind === 'champion') - Number(a.kind === 'champion')
        || dist(a.pos, h.pos) - dist(b.pos, h.pos)).map(f => f.pos), s.map.stairs];
    const goal = goals.find(g => g && !same(g, h.pos) && stepToward(s, g));
    if (goal) {
      mem.detour = { floor: s.run.floor, pos: { ...goal }, steps: 0 };
      mem.notes.push(`f${s.run.floor}: recovered movement cycle at ${h.pos.x},${h.pos.y}`);
      delete mem.lootGoal; delete mem.pursuit;
    }
  }
  if (mem.detour) {
    const dir = stepToward(s, mem.detour.pos);
    if (dir) { mem.detour.steps++; return { kind: 'move', dir, plain: true }; }
    delete mem.detour;
  }
  return action;
}
export function smartDecide(sim: GridSim, mem: BotMemory): GAction {
  return recoverRoute(sim.s, mem, decide(sim, mem));
}
