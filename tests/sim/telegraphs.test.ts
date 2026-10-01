import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { createTelegraph, updateTelegraphs } from '../../src/sim/battle/telegraphs';
import { inArea } from '../../src/sim/battle/areas';
import { getSkill } from '../../src/data/skills';
import { v } from '../../src/core/vec2';

describe('telegraphs & areas', () => {
  it('area shapes', () => {
    expect(inArea({ shape: 'circle', radius: 2, center: 'target' }, v(0, 0), v(1, 0), v(2.3, 0), 1)).toBe(true);
    expect(inArea({ shape: 'circle', radius: 2, center: 'target' }, v(0, 0), v(1, 0), v(2.6, 0), 1)).toBe(false);
    expect(inArea({ shape: 'circle', radius: 2, center: 'target' }, v(0, 0), v(1, 0), v(2.6, 0), 1.3)).toBe(true);
    expect(inArea({ shape: 'cone', radius: 2, angleDeg: 90 }, v(0, 0), v(1, 0), v(0, 1.5), 1)).toBe(false);
    expect(inArea({ shape: 'cone', radius: 2, angleDeg: 90 }, v(0, 0), v(1, 0), v(1.2, 0.5), 1)).toBe(true);
    expect(inArea({ shape: 'line', length: 8, width: 1 }, v(0, 0), v(1, 0), v(6, 0.6), 1)).toBe(true);
    expect(inArea({ shape: 'line', length: 8, width: 1 }, v(0, 0), v(1, 0), v(-1, 0), 1)).toBe(false);
  });
  it('fires at the locked position: units that left are safe', () => {
    const s = createState(setupFromPresets(2, 'standard', 'boss'));
    const boss = s.units.find((u) => u.setup.boss)!;
    const [a, b] = s.units.filter((u) => u.team === 'ally');
    a!.pos = v(0, 0);
    b!.pos = v(0.5, 0);
    a!.setup.stats.dodge = 0;
    createTelegraph(s, boss, getSkill('crushing_slam'), a, undefined);
    b!.pos = v(6, 6);
    const hpA = a!.hp;
    const hpB = b!.hp;
    for (let i = 0; i < 40; i++) {
      updateTelegraphs(s);
      s.tick++;
    }
    expect(a!.hp).toBeLessThan(hpA);
    expect(b!.hp).toBe(hpB);
    expect(s.telegraphs).toHaveLength(0);
    expect(s.events.some((e) => e.type === 'telegraph_fire')).toBe(true);
  });
  it('telegraph is dropped if its caster dies', () => {
    const s = createState(setupFromPresets(2, 'standard', 'boss'));
    const boss = s.units.find((u) => u.setup.boss)!;
    createTelegraph(s, boss, getSkill('crushing_slam'), s.units[0], undefined);
    boss.alive = false;
    updateTelegraphs(s);
    expect(s.telegraphs).toHaveLength(0);
  });
});
