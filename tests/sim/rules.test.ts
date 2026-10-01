import { describe, it, expect } from 'vitest';
import { Battle, runHeadless } from '../../src/sim/battle/battle';
import { setupFromPresets, createState } from '../../src/sim/battle/setup';
import { updateRescue } from '../../src/sim/battle/rescue';
import { updateRules } from '../../src/sim/battle/rules';
import { v } from '../../src/core/vec2';

describe('rules', () => {
  it('rescue revives once at 25% after 2s', () => {
    const s = createState(setupFromPresets(1, 'standard', 'empty'));
    const [a, b] = s.units;
    a!.downed = true;
    a!.hp = 0;
    a!.lifeline = 40;
    a!.pos = v(0, 0);
    b!.pos = v(0.5, 0);
    b!.rescueTarget = a!.id;
    for (let i = 0; i < 39; i++) updateRescue(s);
    expect(a!.downed).toBe(true);
    updateRescue(s);
    expect(a!.downed).toBe(false);
    expect(a!.hp).toBe(Math.round(a!.maxHp * 0.25));
    expect(a!.rescueUsed).toBe(true);
    expect(s.events.some((e) => e.type === 'rescued' && e.src === b!.id && e.dst === a!.id)).toBe(true);
  });
  it('rescue progress resets when the rescuer walks away', () => {
    const s = createState(setupFromPresets(1, 'standard', 'empty'));
    const [a, b] = s.units;
    a!.downed = true;
    a!.pos = v(0, 0);
    b!.pos = v(0.5, 0);
    b!.rescueTarget = a!.id;
    for (let i = 0; i < 20; i++) updateRescue(s);
    b!.pos = v(4, 0);
    updateRescue(s);
    expect(b!.rescueProgress).toBe(0);
  });
  it('berserk ramps after 90s', () => {
    const s = createState(setupFromPresets(1, 'solo', 'tutorial'));
    s.tick = 89 * 20;
    updateRules(s);
    expect(s.berserkMult).toBe(1);
    s.tick = 90 * 20;
    updateRules(s);
    expect(s.berserkMult).toBe(1.5);
    s.tick = 110 * 20;
    updateRules(s);
    expect(s.berserkMult).toBe(2.0);
    expect(s.events.some((e) => e.type === 'berserk')).toBe(true);
  });
  it('boss enters phase 2 below 50%', () => {
    const s = createState(setupFromPresets(1, 'standard', 'boss'));
    const boss = s.units.find((u) => u.setup.boss)!;
    boss.hp = boss.maxHp * 0.49;
    updateRules(s);
    expect(boss.phaseIndex).toBe(1);
    expect(s.events.some((e) => e.type === 'phase')).toBe(true);
    updateRules(s);
    expect(boss.phaseIndex).toBe(1);
  });
  it('retreat command ends the battle', () => {
    const r = runHeadless(setupFromPresets(1, 'standard', 'bandits'), [{ tick: 30, cmd: { type: 'retreat' } }]);
    expect(r.outcome).toBe('retreat');
    expect(r.ticks).toBeLessThanOrEqual(32);
  });
  it('step after outcome is a no-op', () => {
    const b = new Battle(setupFromPresets(1, 'solo', 'empty'));
    b.step();
    const t = b.state.tick;
    b.step();
    expect(b.state.tick).toBe(t);
  });
});
