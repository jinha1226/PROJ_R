/** Headless weekly bot: plays a whole run through the same sim calls the flows make, saving at every step. */
import { expect } from 'vitest';
import { loadRun, saveRun, type KV } from '../../../src/app/save';
import { Battle } from '../../../src/sim/battle/battle';
import type { BattleEvent, BattleSetup } from '../../../src/sim/battle/types';
import { pickEvent } from '../../../src/sim/run/events';
import { chooseExplore, eventSpot, leaveExploration, moveTo, openChest, stageOf, useCampfire, markDone } from '../../../src/sim/explore/progress';
import { roomBattleSetup } from '../../../src/sim/explore/roomBattle';
import { settleRoomBattle } from '../../../src/sim/explore/roomResult';
import { reportFromBattle } from '../../../src/sim/roster/aftermath';
import { autoFormation } from '../../../src/sim/roster/formation';
import { canEquip, equip } from '../../../src/sim/roster/equipment';
import { applyOfferToRoster, levelOffers, settleEmptyLevelUps } from '../../../src/sim/roster/offers';
import { finishBattle } from '../../../src/sim/run/battleNode';
import { ROSTER_CAP } from '../../../src/sim/run/recruit';
import { buy } from '../../../src/sim/run/shop';
import { getItem } from '../../../src/data/items';
import { beginBattle, chooseEvent } from '../../../src/sim/run/savePoints';
import type { RunState } from '../../../src/sim/run/types';
import { bossBattleSetup } from '../../../src/sim/week/boss';
import { endWeek, newRunV2, recruitVisitor, restWeek, skipStart, trainWeek } from '../../../src/sim/week/week';

const memKV = (): KV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

/** Every state the game would save must survive the save format unchanged. */
function saved(run: RunState, kv: KV): RunState {
  expect(saveRun(run, kv)).toBe(true);
  const back = loadRun(kv);
  expect(back).toEqual(JSON.parse(JSON.stringify(run)));
  return back!;
}

function fight(setup: BattleSetup) {
  const b = new Battle(setup);
  const events: BattleEvent[] = [];
  while (!b.outcome) events.push(...b.step().events);
  return { state: b.state, events };
}

const firstChoice = (run: RunState, view: ReturnType<typeof pickEvent>) => chooseEvent(run, view, (view.choices.find((c) => c.available) ?? view.choices[0]!).id).run;

/** A sensible player: deepen what you have before swapping skills. */
const PREFER = ['promote', 'upgrade', 'passive', 'tactic', 'newActive'];

function levelUpAll(run: RunState): RunState {
  let r = settleEmptyLevelUps(run.roster);
  for (let guard = 0; guard < 40; guard++) {
    const m = r.mercs.find((x) => x.pendingLevelUps > 0);
    if (!m) break;
    const offers = levelOffers(m, r, run.seed + run.week);
    const pick = [...offers].sort((a, b) => PREFER.indexOf(a.kind) - PREFER.indexOf(b.kind))[0];
    r = settleEmptyLevelUps(pick ? applyOfferToRoster(r, m.id, pick, 0) : { ...r, mercs: r.mercs.map((x) => (x.id === m.id ? { ...x, pendingLevelUps: 0 } : x)) });
  }
  for (const item of [...r.inventory]) {
    const m = r.mercs.find((x) => canEquip(x, item));
    if (m && r.inventory.includes(item)) r = equip(r, m.id, item);
  }
  return { ...run, roster: r };
}

/** Buys the stock items that upgrade someone's slot, strongest members first, and equips them. */
function shopping(run0: RunState): RunState {
  let run = run0;
  const tierOf = (id?: string) => (id ? getItem(id).tier : -1);
  run.shop!.stock.items.forEach((it, i) => {
    const def = getItem(it.itemId);
    const m = [...run.roster.mercs].filter((x) => x.alive).sort((a, b) => b.level - a.level)
      .find((x) => canEquip(x, it.itemId) && tierOf(x.gear[def.slot]) < def.tier);
    if (!m || it.sold || run.gold < it.price) return;
    const out = buy(run, run.shop!.stock, i);
    run = { ...out.run, shop: { week: run.week, stock: out.stock }, roster: equip(out.run.roster, m.id, it.itemId) };
  });
  return run;
}

/** Walks the map breadth-first, clearing every room it reaches, then leaves through the exit. */
function explore(run0: RunState, kv: KV): RunState {
  let run = run0;
  const order = [run.exploration!.at];
  for (let i = 0; i < order.length; i++) for (const n of Object.values(run.exploration!.rooms[order[i]!]!.doors)) if (!order.includes(n)) order.push(n);
  const path = (from: string, to: string): string[] => {
    const rooms = run.exploration!.rooms;
    const prev: Record<string, string> = { [from]: from };
    const q = [from];
    while (q.length) {
      const id = q.shift()!;
      for (const n of Object.values(rooms[id]!.doors)) if (!(n in prev)) { prev[n] = id; q.push(n); }
    }
    const out = [to];
    while (out[0] !== from) out.unshift(prev[out[0]!]!);
    return out.slice(1);
  };
  for (const target of order.slice(1)) {
    for (const step of path(run.exploration!.at, target)) {
      run = saved({ ...run, exploration: moveTo(run.exploration!, step) }, kv);
      const e = run.exploration!;
      const room = e.rooms[step]!;
      if (room.done) continue;
      if (room.type === 'battle' || room.type === 'elite') {
        run = saved(beginBattle(run, run.formation), kv);
        const setup = roomBattleSetup(run, step, run.formation);
        const { state, events } = fight(setup);
        run = saved(settleRoomBattle(run, step, setup.allies.map((u) => u.id), reportFromBattle(state, events, stageOf(e, room))).run, kv);
        if (run.phase === 'report' || run.status !== 'active') return run;
      } else if (room.type === 'chest') run = saved(openChest(run), kv);
      else if (room.type === 'campfire') run = saved(useCampfire(run), kv);
      else if (room.type === 'event') run = saved(markDone(firstChoice(run, pickEvent(run, eventSpot(run))), step), kv);
      else if (room.type === 'exit') return saved(leaveExploration(run), kv);
    }
  }
  return saved(leaveExploration(run), kv);
}

/** A sensible-but-naive player: recruits, shops, ★1 regions, rests when hurt and before the boss. */
export function playRun(seed: number): { run: RunState; weeks: string[]; preBoss?: RunState } {
  const kv = memKV();
  let run = saved(newRunV2(seed, 'x'), kv);
  const weeks: string[] = [];
  while (run.status === 'active' && run.phase !== 'boss') {
    if (run.visitors?.length) {
      const c = run.roster.mercs.length < ROSTER_CAP ? run.visitors.find((v) => v.fee <= run.gold) : undefined;
      run = saved(c ? recruitVisitor(run, c) : { ...run, visitors: undefined }, kv);
    }
    if (run.startEvent) run = saved({ ...firstChoice(run, run.startEvent), startEvent: undefined }, kv);
    if (run.phase === 'start') run = saved(skipStart(run), kv);
    run = saved(shopping(run), kv);
    const healthy = run.roster.mercs.filter((m) => m.alive && m.injury === 0).map((m) => m.id);
    const hurt = run.roster.mercs.some((m) => m.alive && m.injury > 1);
    if (run.week === 1 || healthy.length === 0) { run = saved(trainWeek(run, healthy.slice(0, 5)), kv); weeks.push('train'); }
    else if (hurt || run.week === 11) { run = saved(restWeek(run), kv); weeks.push('rest'); }
    else {
      const card = run.regionCards!.reduce((best, c, i, all) => (c.stars < all[best]!.stars ? i : best), 0);
      run = explore(saved(chooseExplore(run, card, healthy), kv), kv);
      weeks.push('explore');
    }
    if (run.status !== 'active') break;
    expect(run.phase).toBe('report');
    run = saved(endWeek(levelUpAll(run)), kv);
  }
  const preBoss = run.status === 'active' ? run : undefined;
  if (run.status === 'active') {
    expect(run.week).toBe(12);
    // the boss gets the five strongest, rested in week 11
    const top = run.roster.mercs.filter((m) => m.alive).sort((a, b) => b.level - a.level).slice(0, 5);
    const formation = Object.fromEntries(autoFormation(top).map(({ merc, col, row }) => [merc.id, { col, row }]));
    run = saved(beginBattle(run, formation), kv);
    const setup = bossBattleSetup(run, formation);
    const { state, events } = fight(setup);
    run = saved(finishBattle(run, { kind: 'boss', stage: 12, key: 1212 }, setup.allies.map((u) => u.id), reportFromBattle(state, events, 12)).run, kv);
  }
  return { run, weeks, preBoss };
}
