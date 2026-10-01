import { describe, it, expect } from 'vitest';
import { createState, setupFromPresets } from '../../src/sim/battle/setup';
import { startAction, advanceActions, isReady, tickCooldowns } from '../../src/sim/battle/actions';
import { v } from '../../src/core/vec2';

const duel = () => {
  const s = createState(setupFromPresets(5, 'solo', 'tutorial'));
  const a = s.units[0]!;
  const e = s.units[1]!;
  a.pos = v(0, 0);
  e.pos = v(1, 0);
  a.setup.stats.crit = 0;
  e.setup.stats.dodge = 0;
  return { s, a, e };
};

describe('actions', () => {
  it('runs windup → active (hit) → recovery → done', () => {
    const { s, a, e } = duel();
    const hp = e.hp;
    startAction(s, a, 'novice_slash', e.id);
    let ticks = 0;
    while (a.action && ticks < 100) {
      advanceActions(s);
      ticks++;
    }
    expect(e.hp).toBeLessThan(hp);
    expect(ticks).toBe(7 + 2 + 9);
    expect(a.decisionIn).toBe(0);
  });
  it('basic attack windup scales with attack speed', () => {
    const { s, a, e } = duel();
    a.setup.stats.atkSpeed = 2;
    startAction(s, a, 'novice_slash', e.id);
    expect(a.action!.ticksLeft).toBe(Math.round((0.35 / 2) * 20));
  });
  it('cancels when the target dies during windup', () => {
    const { s, a, e } = duel();
    startAction(s, a, 'novice_slash', e.id);
    e.alive = false;
    for (let i = 0; i < 20; i++) advanceActions(s);
    expect(s.events.some((x) => x.type === 'action_cancel')).toBe(true);
    expect(a.action).toBeNull();
  });
  it('stun interrupts an action', () => {
    const { s, a, e } = duel();
    startAction(s, a, 'novice_slash', e.id);
    a.tags.push({ tag: 'stun', ticksLeft: 5, value: 0, srcId: e.id });
    advanceActions(s);
    expect(a.action).toBeNull();
  });
  it('sets cooldown on fire and ultimate needs full momentum', () => {
    const { s, a, e } = duel();
    expect(isReady(a, 'novice_desperate')).toBe(false);
    a.momentum = 100;
    expect(isReady(a, 'novice_desperate')).toBe(true);
    startAction(s, a, 'novice_lunge', e.id);
    for (let i = 0; i < 7; i++) advanceActions(s);
    expect(a.cooldowns['novice_lunge']).toBe(7 * 20);
    expect(isReady(a, 'novice_lunge')).toBe(false);
    tickCooldowns(s);
    expect(a.cooldowns['novice_lunge']).toBe(7 * 20 - 1);
  });
});
