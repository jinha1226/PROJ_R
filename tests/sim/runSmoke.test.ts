import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/sim/battle/battle';
import { reportFromBattle } from '../../src/sim/roster/aftermath';
import { canEquip, equip } from '../../src/sim/roster/equipment';
import { applyOfferToRoster, levelOffers, settleEmptyLevelUps } from '../../src/sim/roster/offers';
import { battleSetupForNode, finishBattle } from '../../src/sim/run/battleNode';
import { pickEvent, resolveEvent } from '../../src/sim/run/events';
import { encounterCandidates, recruit, ROSTER_CAP } from '../../src/sim/run/recruit';
import { restHeal } from '../../src/sim/run/rest';
import { enterNode, newRun, reachable } from '../../src/sim/run/state';
import type { BattleEvent } from '../../src/sim/battle/types';
import type { RunState } from '../../src/sim/run/types';

const PREF = ['battle', 'encounter', 'elite', 'rest', 'event', 'shop', 'boss'];

function step(run: RunState): RunState {
  const options = reachable(run).sort((a, b) => PREF.indexOf(a.type) - PREF.indexOf(b.type));
  let r = enterNode(run, options[0]!.id);
  const node = r.map.nodes[r.at!]!;
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    const setup = battleSetupForNode(r, node);
    const b = new Battle(setup);
    const events: BattleEvent[] = [];
    while (!b.outcome) events.push(...b.step().events);
    r = finishBattle(r, node, setup.allies.map((u) => u.id), reportFromBattle(b.state, events, node.step)).run;
    r = { ...r, roster: settleEmptyLevelUps(r.roster) };
    for (let g = 0; g < 30; g++) {
      const m = r.roster.mercs.find((x) => x.pendingLevelUps > 0);
      if (!m) break;
      const offers = levelOffers(m, r.roster, r.seed + r.roster.battles);
      r = { ...r, roster: settleEmptyLevelUps(offers.length ? applyOfferToRoster(r.roster, m.id, offers[0]!, 0) : r.roster) };
    }
    for (const item of [...r.roster.inventory]) {
      const m = r.roster.mercs.find((x) => canEquip(x, item) && !x.gear[item.includes('_') ? 'weapon' : 'armor']);
      if (m && r.roster.inventory.includes(item)) r = { ...r, roster: equip(r.roster, m.id, item) };
    }
  } else if (node.type === 'encounter') {
    const c = encounterCandidates(r, node).find((x) => x.fee <= r.gold);
    if (c && r.roster.mercs.length < ROSTER_CAP) r = recruit(r, c);
  } else if (node.type === 'event') {
    const v = pickEvent(r, node);
    const choice = v.choices.find((x) => x.available);
    if (choice) r = resolveEvent(r, v, choice.id).run;
  } else if (node.type === 'rest') r = restHeal(r);
  return { ...r, pending: undefined };
}

function play(seed: number): RunState {
  let r = newRun(seed, 'x');
  for (let i = 0; i < 12 && r.status === 'active'; i++) r = step(r);
  return r;
}

describe('full run smoke', () => {
  it('runs end to end without errors and is deterministic', () => {
    const results = [1, 2, 3, 4, 5].map((s) => {
      const r = play(s);
      return { status: r.status, step: r.at ? r.map.nodes[r.at]!.step : 0, party: r.roster.mercs.length, levels: r.roster.mercs.map((m) => m.level) };
    });
    console.log('run smoke', JSON.stringify(results));
    for (const x of results) expect(['won', 'lost']).toContain(x.status);
    expect(results.some((x) => x.step >= 6)).toBe(true);
    expect(JSON.stringify(play(3))).toBe(JSON.stringify(play(3)));
  });
});
