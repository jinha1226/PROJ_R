import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { enemyGroup } from '../../src/sim/run/encounters';
import { battleSetupForNode, finishBattle, checkRunEnd } from '../../src/sim/run/battleNode';
import { newRun, enterNode, reachable } from '../../src/sim/run/state';
import type { BattleReport } from '../../src/sim/roster/aftermath';
import type { RunState, MapNode } from '../../src/sim/run/types';
import { generateRecruit } from '../../src/sim/roster/generate';

const withParty = (): RunState => {
  const r = newRun(11, 'x');
  const rng = createRng(3);
  const used = new Set<string>();
  const extra = [1, 2, 3].map((i) => generateRecruit(rng, { level: 3, usedNames: used, id: `m${i}` }));
  return { ...r, roster: { ...r.roster, mercs: [...r.roster.mercs, ...extra], nextId: 4 } };
};
const node = (r: RunState, type: MapNode['type'], step = 5): MapNode => ({ ...Object.values(r.map.nodes).find((n) => n.step === step)!, type });
const report = (r: RunState, over: Partial<BattleReport> = {}): BattleReport => ({
  outcome: 'victory', stage: 5, events: [], enemies: {},
  units: r.roster.mercs.map((m) => ({ id: m.id, alive: true, downed: false, minLifelineFrac: 1 })), ...over,
});

describe('battle nodes', () => {
  it('enemy groups grow with stage; step 1 is a small tutorial; elites have a chief; the boss is the ashen knight', () => {
    const rng = createRng(1);
    const t = enemyGroup(rng, 'battle', 1);
    expect(t.length).toBeLessThanOrEqual(3);
    expect(t.every((e) => e.enemyId === 'skeleton_minion')).toBe(true);
    expect(enemyGroup(createRng(2), 'battle', 9).length).toBeGreaterThan(enemyGroup(createRng(2), 'battle', 2).length);
    expect(enemyGroup(createRng(3), 'elite', 5).some((e) => e.enemyId === 'bandit_chief')).toBe(true);
    expect(enemyGroup(createRng(4), 'boss', 12).some((e) => e.enemyId === 'ashen_knight')).toBe(true);
  });
  it('battle setups use the saved formation', () => {
    let r = withParty();
    r = { ...r, formation: { m0: { col: 0, row: 3 }, m1: { col: 2, row: 0 } } };
    const s = battleSetupForNode(r, node(r, 'battle'));
    expect(s.allies.map((a) => a.id)).toEqual(['m0', 'm1']);
    expect(s.allies[0]!.slot).toEqual({ col: 0, row: 3 });
  });
  it('victory pays gold; elites add a guaranteed elite+ item', () => {
    const r = withParty();
    const ids = r.roster.mercs.map((m) => m.id);
    const a = finishBattle(r, node(r, 'battle'), ids, report(r));
    expect(a.run.gold).toBe(r.gold + 20 + 5 * 5);
    const e = finishBattle(r, node(r, 'elite'), ids, report(r));
    expect(e.run.gold).toBe(r.gold + 40 + 8 * 5);
    expect(e.reward.items.length).toBeGreaterThanOrEqual(2);
  });
  it('retreat: everyone injured, 30% gold lost, no loot', () => {
    const r = withParty();
    const ids = r.roster.mercs.map((m) => m.id);
    const out = finishBattle(r, node(r, 'battle'), ids, report(r, { outcome: 'retreat' }));
    expect(out.run.gold).toBe(Math.floor(r.gold * 0.7));
    expect(out.reward.items).toEqual([]);
    expect(out.run.roster.mercs.every((m) => m.injury >= 2)).toBe(true);
  });
  it('protagonist death ends the run; boss victory wins it', () => {
    const r = withParty();
    const ids = r.roster.mercs.map((m) => m.id);
    const dead = finishBattle(r, node(r, 'battle'), ids, report(r, { outcome: 'defeat', units: report(r).units.map((u) => (u.id === 'm0' ? { ...u, alive: false } : u)) }));
    expect(dead.run.status).toBe('lost');
    expect(checkRunEnd(dead.run)).toBe('lost');
    const boss = finishBattle(r, node(r, 'boss', 12), ids, report(r));
    expect(boss.run.status).toBe('won');
  });
  it('does not mutate the run', () => {
    const r = withParty();
    const snap = JSON.stringify(r);
    finishBattle(r, node(r, 'battle'), ['m0'], report(r));
    expect(JSON.stringify(r)).toBe(snap);
  });
  it('a real run can enter step 1 and build its battle', () => {
    let r = newRun(4, 'x');
    r = enterNode(r, reachable(r)[0]!.id);
    const s = battleSetupForNode(r, r.map.nodes[r.at!]!);
    expect(s.allies).toHaveLength(1);
    expect(s.enemies.length).toBeGreaterThan(0);
  });
});
