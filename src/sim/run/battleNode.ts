import { createRng } from '../../core/rng';
import { ITEMS } from '../../data/items';
import type { BattleSetup } from '../battle/types';
import { resolveBattle, type Aftermath, type BattleReport } from '../roster/aftermath';
import { companyBattleSetup } from '../roster/companyBattle';
import { enemyGroup } from './encounters';
import type { MapNode, RunState, RunStatus } from './types';

const nodeSeed = (run: RunState, node: MapNode) => (run.seed * 7919 + node.step * 131 + node.lane * 17) >>> 0;
const RETREAT_GOLD = 0.7;
const RETREAT_INJURY = 2;

/** Formation: saved slots for the mercs placed in the run formation; falls back to auto formation. */
export function battleSetupForNode(run: RunState, node: MapNode): BattleSetup {
  const type = node.type === 'elite' || node.type === 'boss' ? node.type : 'battle';
  const rng = createRng(nodeSeed(run, node));
  const placedIds = Object.keys(run.formation).filter((id) => run.roster.mercs.some((m) => m.id === id && m.alive));
  const deployed = placedIds.length ? run.roster.mercs.filter((m) => placedIds.includes(m.id)).map((m) => m.id) : run.roster.mercs.slice(0, 5).map((m) => m.id);
  return companyBattleSetup(run.roster, deployed, enemyGroup(rng, type, node.step), node.step, nodeSeed(run, node), placedIds.length ? run.formation : undefined);
}

export function checkRunEnd(run: RunState): RunStatus {
  if (run.status === 'won') return 'won';
  const alive = run.roster.mercs.filter((m) => m.alive);
  if (alive.length === 0 || !alive.some((m) => m.protagonist)) return 'lost';
  return run.status;
}

const goldFor = (node: MapNode): number =>
  node.type === 'boss' ? 200 : node.type === 'elite' ? 40 + 8 * node.step : 20 + 5 * node.step;

/** Applies a battle's result to the run: aftermath, rewards or retreat penalties, and run end checks. */
export function finishBattle(run: RunState, node: MapNode, deployed: string[], report: BattleReport): { run: RunState; aftermath: Aftermath; reward: { gold: number; items: string[] } } {
  const aftermath = resolveBattle(run.roster, deployed, report);
  let roster = aftermath.roster;
  let gold = run.gold;
  const items = [...aftermath.loot];
  if (report.outcome === 'victory') {
    gold += goldFor(node);
    if (node.type === 'elite') {
      const rng = createRng(nodeSeed(run, node) ^ 0xe1173);
      const elite = rng.pick(Object.values(ITEMS).filter((i) => i.tier >= 2 && i.tier <= Math.min(4, 2 + Math.floor(node.step / 5))));
      items.push(elite.id);
      roster = { ...roster, inventory: [...roster.inventory, elite.id] };
    }
  } else {
    gold = Math.floor(gold * RETREAT_GOLD);
    roster = { ...roster, mercs: roster.mercs.map((m) => (deployed.includes(m.id) ? { ...m, injury: Math.max(m.injury, RETREAT_INJURY) } : m)) };
  }
  let next: RunState = { ...run, roster, gold, pending: undefined };
  if (node.type === 'boss') next = { ...next, status: report.outcome === 'victory' ? 'won' : 'lost' }; // nothing lies beyond the boss
  next = { ...next, status: checkRunEnd(next) };
  return { run: next, aftermath: { ...aftermath, roster }, reward: { gold: gold - run.gold, items } };
}
