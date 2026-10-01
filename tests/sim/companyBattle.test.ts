import { describe, it, expect } from 'vitest';
import { newRoster } from '../../src/sim/roster/generate';
import { companyBattleSetup, stageFor, deployable } from '../../src/sim/roster/companyBattle';
import { runHeadless } from '../../src/sim/battle/battle';

describe('company battles', () => {
  it('builds a setup from deployed mercs with their relations and a scaled enemy stage', () => {
    const r = { ...newRoster(4, 4), relations: [{ a: 'm0', b: 'm1', affinity: 50, rival: false, battlesTogether: 1, contests: 0 }] };
    const setup = companyBattleSetup(r, ['m0', 'm1', 'm2'], 'bandits', 3, 99);
    expect(setup.allies.map((u) => u.id)).toEqual(['m0', 'm1', 'm2']);
    expect(setup.allies[0]!.isLeader).toBe(true);
    expect(setup.relations).toHaveLength(1);
    expect(setup.enemies.length).toBeGreaterThan(0);
    expect(runHeadless(setup).outcome).toBeTruthy();
  });
  it('stage grows with battles and caps at 12', () => {
    expect(stageFor(0)).toBe(1);
    expect(stageFor(4)).toBe(3);
    expect(stageFor(100)).toBe(12);
  });
  it('deployable lists living mercs, healthy first, max 5', () => {
    const r = newRoster(4, 6);
    const hurt = { ...r, mercs: r.mercs.map((m, i) => (i === 0 ? { ...m, injury: 2 } : m)) };
    const d = deployable(hurt);
    expect(d).toHaveLength(5);
    expect(d).not.toContain('m0');
  });
});
