import { createRng } from '../../core/rng';
import { ITEMS } from '../../data/items';
import { resolveBattle, type Aftermath, type BattleReport } from '../roster/aftermath';
import type { RunState, RunStatus } from './types';

export interface BattleCtx {
  kind: 'battle' | 'elite' | 'boss';
  stage: number;
  /** seed salt so different battles in the same week roll different loot */
  key: number;
}

const RETREAT_GOLD = 0.7;
const RETREAT_INJURY = 2;

export function checkRunEnd(run: RunState): RunStatus {
  if (run.status === 'won') return 'won';
  const alive = run.roster.mercs.filter((m) => m.alive);
  if (alive.length === 0 || !alive.some((m) => m.protagonist)) return 'lost';
  return run.status;
}

const goldFor = (ctx: BattleCtx): number =>
  ctx.kind === 'boss' ? 200 : ctx.kind === 'elite' ? 40 + 8 * ctx.stage : 20 + 5 * ctx.stage;

/** Applies a battle's result to the run: aftermath, rewards or retreat penalties, and run end checks. */
export function finishBattle(run: RunState, ctx: BattleCtx, deployed: string[], report: BattleReport): { run: RunState; aftermath: Aftermath; reward: { gold: number; items: string[] } } {
  const aftermath = resolveBattle(run.roster, deployed, report, { perBattleHeal: false });
  let roster = aftermath.roster;
  let gold = run.gold;
  const items = [...aftermath.loot];
  if (report.outcome === 'victory') {
    gold += goldFor(ctx);
    if (ctx.kind === 'elite') {
      const rng = createRng((run.seed * 7919 + ctx.key * 131) ^ 0xe1173);
      const elite = rng.pick(Object.values(ITEMS).filter((i) => i.tier >= 2 && i.tier <= Math.min(4, 2 + Math.floor(ctx.stage / 5))));
      items.push(elite.id);
      roster = { ...roster, inventory: [...roster.inventory, elite.id] };
    }
  } else {
    gold = Math.floor(gold * RETREAT_GOLD);
    roster = { ...roster, mercs: roster.mercs.map((m) => (deployed.includes(m.id) ? { ...m, injury: Math.max(m.injury, RETREAT_INJURY) } : m)) };
  }
  let next: RunState = { ...run, roster, gold, pending: undefined };
  if (ctx.kind === 'boss') next = { ...next, status: report.outcome === 'victory' ? 'won' : 'lost' }; // nothing lies beyond the boss
  next = { ...next, status: checkRunEnd(next) };
  return { run: next, aftermath: { ...aftermath, roster }, reward: { gold: gold - run.gold, items } };
}
