import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { finishBattle, checkRunEnd, type BattleCtx } from '../../src/sim/run/battleNode';
import { newRunV2 } from '../../src/sim/week/week';
import type { BattleReport } from '../../src/sim/roster/aftermath';
import type { RunState } from '../../src/sim/run/types';
import { generateRecruit } from '../../src/sim/roster/generate';

const withParty = (): RunState => {
  const r = newRunV2(11, 'x');
  const rng = createRng(3);
  const used = new Set<string>();
  const extra = [1, 2, 3].map((i) => generateRecruit(rng, { level: 3, usedNames: used, id: `m${i}` }));
  return { ...r, roster: { ...r.roster, mercs: [...r.roster.mercs, ...extra], nextId: 4 } };
};
const ctx = (kind: BattleCtx['kind'], stage = 5): BattleCtx => ({ kind, stage, key: 1 });
const report = (r: RunState, over: Partial<BattleReport> = {}): BattleReport => ({
  outcome: 'victory', stage: 5, events: [], enemies: {},
  units: r.roster.mercs.map((m) => ({ id: m.id, alive: true, downed: false, minLifelineFrac: 1 })), ...over,
});

describe('battle results', () => {
  it('victory pays gold; elites add a guaranteed elite+ item', () => {
    const r = withParty();
    const ids = r.roster.mercs.map((m) => m.id);
    expect(finishBattle(r, ctx('battle'), ids, report(r)).run.gold).toBe(r.gold + 20 + 5 * 5);
    const e = finishBattle(r, ctx('elite'), ids, report(r));
    expect(e.run.gold).toBe(r.gold + 40 + 8 * 5);
    expect(e.reward.items.length).toBeGreaterThanOrEqual(2);
  });
  it('retreat: everyone injured, 30% gold lost, no loot', () => {
    const r = withParty();
    const ids = r.roster.mercs.map((m) => m.id);
    const out = finishBattle(r, ctx('battle'), ids, report(r, { outcome: 'retreat' }));
    expect(out.run.gold).toBe(Math.floor(r.gold * 0.7));
    expect(out.reward.items).toEqual([]);
    expect(out.run.roster.mercs.every((m) => m.injury >= 2)).toBe(true);
  });
  it('protagonist death ends the run; boss victory wins, boss defeat loses', () => {
    const r = withParty();
    const ids = r.roster.mercs.map((m) => m.id);
    const dead = finishBattle(r, ctx('battle'), ids, report(r, { outcome: 'defeat', units: report(r).units.map((u) => (u.id === 'm0' ? { ...u, alive: false } : u)) }));
    expect(dead.run.status).toBe('lost');
    expect(checkRunEnd(dead.run)).toBe('lost');
    expect(finishBattle(r, ctx('boss', 12), ids, report(r)).run.status).toBe('won');
    expect(finishBattle(r, ctx('boss', 12), ids, report(r, { outcome: 'retreat' })).run.status).toBe('lost');
  });
  it('does not mutate the run', () => {
    const r = withParty();
    const snap = JSON.stringify(r);
    finishBattle(r, ctx('battle'), ['m0'], report(r));
    expect(JSON.stringify(r)).toBe(snap);
  });
});
