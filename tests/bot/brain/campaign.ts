import { ENGRAVES, type EngraveId } from '../../../src/sim/grid/engraveCore';
import type { Family } from '../../../src/sim/grid/engraveDefs';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { buy, engraveShop, freshMeta, settleRun, SHOP, type MetaState } from '../../../src/sim/grid/meta';
import { canCraft, craft, fit, MODS, type ModDef } from '../../../src/sim/grid/mods';
import { canRepair, repair, type SystemId } from '../../../src/sim/grid/repairs';
import type { GridState } from '../../../src/sim/grid/types';
import { runBot, type BotResult } from '../runBot';
import { archetype, scoreCard } from './build';

export interface CampaignRun extends BotResult {
  index: number; startSuit: EngraveId[]; metaStart: MetaState; metaSettled: MetaState; metaAfter: MetaState;
  materials: MetaState['materials']; repairs: SystemId[]; unlocked: number;
}
export interface CampaignResult { runs: CampaignRun[]; firstWin: number | null; bestFloor: number; last10Average: number }
const REPAIRS: SystemId[] = ['workbench', 'suitlab', 'nav', 'lifeSupport', 'pod'];
const SHOP_VALUE: Record<string, number> = {
  'round:fire': 16, 'round:shock': 15, suitSlots3: 14, suitSlots4: 13, chargePlus1: 12, chargePlus2: 11,
};
const modValue = (m: ModDef, family: Family): number => {
  const v = m.stats;
  return (v.maxHp ?? 0) + (v.shield ?? 0) * 2 + (v.evasion ?? 0) * 20
    + (family === 'melee' ? (v.meleeDmg ?? 0) * 4
      : (v.gunDmg ?? 0) * 4 + (v.hit ?? 0) * 30 + (v.maxCharge ?? 0) + -(v.swap ?? 0) * 8);
};
/** Only meta is edited here. Scoring contexts are detached read-only projections of the last run. */
export function spendMeta(meta: MetaState, state: GridState): void {
  for (const id of REPAIRS) if (canRepair(meta, id)) repair(meta, id);
  const family = archetype(state);
  for (const mod of [...MODS].sort((a, b) => modValue(b, family) - modValue(a, family))) {
    const old = MODS.find(m => m.id === meta.mods.fitted[mod.slot]);
    if (modValue(mod, family) <= (old ? modValue(old, family) : 0)) continue;
    if (canCraft(meta, mod.id)) craft(meta, mod.id);
    if (meta.mods.owned.includes(mod.id)) fit(meta, mod.slot, mod.id);
  }
  for (;;) {
    const context = { ...state, hero: { ...state.hero, suit: [], rounds: meta.rounds.slice(0, 2) } };
    const facilities = SHOP.filter(e => SHOP_VALUE[e.id] && e.can(meta) && e.cost <= meta.energy
      && (e.id !== 'round:shock' || meta.rounds.includes('fire'))).map(e => ({ ...e, value: SHOP_VALUE[e.id]! }));
    const engravings = meta.repairs.includes('suitlab') ? engraveShop(meta).filter(e => e.cost <= meta.energy).map(e => {
      const id = e.id.slice(8) as EngraveId;
      const score = scoreCard(context, id);
      return { ...e, value: score > 0 ? score + (ENGRAVES[id].family === family ? 2 : 0) : 0 };
    }) : [];
    const best = [...facilities, ...engravings].filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value || a.cost - b.cost || a.id.localeCompare(b.id))[0];
    if (!best || !buy(meta, best.id)) break;
  }
}
export function startSuit(meta: MetaState, state: GridState): EngraveId[] {
  const suit: EngraveId[] = [];
  while (suit.length < meta.facilities.suitSlots) {
    const context = { ...state, hero: { ...state.hero, suit, rounds: meta.rounds.slice(0, 1) } };
    const next = meta.unlocked.filter(id => !suit.includes(id)).sort((a, b) => scoreCard(context, b) - scoreCard(context, a))[0];
    if (!next || scoreCard(context, next) <= 0) break;
    suit.push(next);
  }
  return suit;
}
export function runCampaign(seed: number, runs = 30): CampaignResult {
  let meta = freshMeta();
  let context = GridSim.createRun(seed, meta, { gun: 'pistol', start: 1, startSuit: [] }).s;
  const results: CampaignRun[] = [];
  for (let i = 0; i < runs; i++) {
    const metaStart = structuredClone(meta), suit = startSuit(meta, context);
    const result = runBot(seed + i * 7, { god: false, policy: 'smart', meta, startSuit: suit,
      round: meta.rounds[0], onFinish: s => { context = s; } });
    meta = settleRun(meta, context);
    const metaSettled = structuredClone(meta);
    spendMeta(meta, context);
    results.push({ ...result, index: i + 1, startSuit: suit, metaStart, metaSettled, metaAfter: structuredClone(meta),
      materials: { ...meta.materials }, repairs: [...meta.repairs], unlocked: meta.unlocked.length });
  }
  const tail = results.slice(-10);
  return { runs: results, firstWin: results.find(r => r.outcome === 'won')?.index ?? null,
    bestFloor: Math.max(0, ...results.map(r => r.floor)), last10Average: tail.length ? tail.reduce((a, r) => a + r.floor, 0) / tail.length : 0 };
}
