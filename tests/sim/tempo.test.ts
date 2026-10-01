import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';
import { WorldSim, idleInput } from '../../src/sim/world/worldSim';
import { heroUnit } from '../../src/sim/world/worldState';
import { testRegion, crew } from './support/worldKit';

const firstWindup = (tempo?: number) => {
  const b = new Battle({ ...setupFromPresets(1, 'standard', 'bandits'), tempo });
  for (let i = 0; i < 400; i++) {
    b.step();
    const a = b.state.units.find((u) => u.action && u.action.phase === 'windup' && u.action.ticksLeft === u.action.totalTicks - 1 && u.setup.basic !== u.action.skillId);
    if (a) return { total: a.action!.totalTicks, skill: a.action!.skillId, unit: a.id };
  }
  return null;
};

describe('sortie tempo', () => {
  it('skills wind up faster and come back sooner when the tempo is raised', () => {
    const base = new Battle(setupFromPresets(1, 'standard', 'bandits'));
    const fast = new Battle({ ...setupFromPresets(1, 'standard', 'bandits'), tempo: 1.33 });
    expect(fast.state.tempo).toBe(1.33);
    expect(base.state.tempo).toBe(1);
    const a = firstWindup();
    expect(a).not.toBeNull();
  });

  it('a party sortie moves faster than its base speed', () => {
    const s = WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }), crew(1), [], null, 1);
    expect(s.w.b.moveScale).toBeCloseTo(1.3);
    expect(s.w.b.tempo).toBeCloseTo(1.33);
    const x0 = heroUnit(s.w).pos.x;
    for (let i = 0; i < 20; i++) s.step({ ...idleInput(), move: { x: 1, y: 0 } });
    const moved = heroUnit(s.w).pos.x - x0;
    expect(moved).toBeGreaterThan(heroUnit(s.w).setup.stats.moveSpeed * 1.2);
  });

  it('windup ticks shrink with the tempo', async () => {
    const { startAction } = await import('../../src/sim/battle/actions');
    const mk = (tempo?: number) => { const b = new Battle({ ...setupFromPresets(1, 'standard', 'bandits'), tempo }); const u = b.state.units[0]!; startAction(b.state, u, u.setup.actives[0]!, b.state.units.find((x) => x.team === 'enemy')!.id); return u.action!.totalTicks; };
    expect(mk(1.33)).toBeLessThan(mk() * 0.85);
  });
});
