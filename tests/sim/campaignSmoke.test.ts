import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/sim/battle/battle';
import { newRoster } from '../../src/sim/roster/generate';
import { companyBattleSetup, deployable, stageFor } from '../../src/sim/roster/companyBattle';
import { reportFromBattle, resolveBattle } from '../../src/sim/roster/aftermath';
import { applyOfferToRoster, levelOffers, settleEmptyLevelUps } from '../../src/sim/roster/offers';
import { canEquip, equip } from '../../src/sim/roster/equipment';
import type { BattleEvent } from '../../src/sim/battle/types';
import type { Roster } from '../../src/sim/roster/types';

const ENEMIES = ['tutorial', 'bandits', 'skeletons', 'bandits', 'ambush', 'skeletons'];

function campaign(seed: number, battles: number): Roster {
  let r = newRoster(seed, 4);
  for (let i = 0; i < battles && r.mercs.length; i++) {
    const deployed = deployable(r);
    const setup = companyBattleSetup(r, deployed, ENEMIES[i % ENEMIES.length]!, stageFor(r.battles), seed * 100 + i);
    const b = new Battle(setup);
    const events: BattleEvent[] = [];
    while (!b.outcome) events.push(...b.step().events);
    r = settleEmptyLevelUps(resolveBattle(r, setup.allies.map((u) => u.id), reportFromBattle(b.state, events, stageFor(r.battles))).roster);
    for (let guard = 0; guard < 20; guard++) {
      const m = r.mercs.find((x) => x.pendingLevelUps > 0);
      if (!m) break;
      const offers = levelOffers(m, r, r.seed + r.battles);
      r = offers.length ? applyOfferToRoster(r, m.id, offers[0]!, 0) : settleEmptyLevelUps(r);
    }
    for (const item of [...r.inventory]) {
      const m = r.mercs.find((x) => canEquip(x, item));
      if (m && r.inventory.includes(item)) r = equip(r, m.id, item);
    }
  }
  return r;
}

describe('campaign smoke', () => {
  it('12 battles run without errors, mercs grow, and stories accumulate', () => {
    const r = campaign(7, 12);
    expect(r.battles).toBeGreaterThan(0);
    const all = [...r.mercs, ...r.memorial];
    const avgLevel = all.reduce((a, m) => a + m.level, 0) / all.length;
    expect(avgLevel).toBeGreaterThan(2);
    expect(all.reduce((a, m) => a + m.chronicle.length, 0)).toBeGreaterThan(all.length * 3);
    expect(r.mercs.every((m) => m.pendingLevelUps === 0)).toBe(true);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(campaign(3, 6))).toBe(JSON.stringify(campaign(3, 6)));
  });
});
