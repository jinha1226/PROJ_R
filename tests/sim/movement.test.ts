import { describe, it, expect } from 'vitest';
import { setupFromPresets, createState } from '../../src/sim/battle/setup';
import { steerToward, moveUnits } from '../../src/sim/battle/movement';
import { updateEngagement } from '../../src/sim/battle/engagement';
import { dist, v } from '../../src/core/vec2';

const solo = () => createState(setupFromPresets(1, 'solo', 'empty'));

describe('movement', () => {
  it('moves toward destination at moveSpeed', () => {
    const s = solo();
    const u = s.units[0]!;
    const start = { ...u.pos };
    for (let i = 0; i < 20; i++) {
      steerToward(u, v(0, 0), s, 0.1);
      moveUnits(s);
    }
    expect(dist(start, u.pos)).toBeCloseTo(3.2, 1);
  });
  it('never leaves the arena', () => {
    const s = solo();
    const u = s.units[0]!;
    for (let i = 0; i < 200; i++) {
      steerToward(u, v(-50, 50), s, 0);
      moveUnits(s);
    }
    expect(u.pos.x).toBeGreaterThanOrEqual(-12);
    expect(u.pos.y).toBeLessThanOrEqual(7);
  });
  it('is pushed out of obstacles', () => {
    const s = solo();
    s.obstacles = [{ pos: v(-3, -1.5), radius: 1, kind: 'rock' }];
    const u = s.units[0]!;
    for (let i = 0; i < 100; i++) {
      steerToward(u, v(0, -1.5), s, 0.1);
      moveUnits(s);
      expect(dist(u.pos, v(-3, -1.5))).toBeGreaterThanOrEqual(1 + 0.45 - 1e-6);
    }
  });
  it('separates overlapping allies', () => {
    const s = createState(setupFromPresets(1, 'standard', 'empty'));
    const [a, b] = s.units;
    a!.pos = v(0, 0);
    b!.pos = v(0.1, 0);
    for (let i = 0; i < 20; i++) moveUnits(s);
    expect(dist(a!.pos, b!.pos)).toBeGreaterThan(0.6);
  });
  it('does not move while stunned', () => {
    const s = solo();
    const u = s.units[0]!;
    const p = { ...u.pos };
    u.tags.push({ tag: 'stun', ticksLeft: 10, value: 0, srcId: 'x' });
    steerToward(u, v(0, 0), s, 0);
    moveUnits(s);
    expect(u.pos).toEqual(p);
  });
  it('stops at stopDist', () => {
    const s = solo();
    const u = s.units[0]!;
    u.pos = v(0, 0);
    steerToward(u, v(1, 0), s, 1.5);
    expect(u.vel).toEqual({ x: 0, y: 0 });
  });
});

describe('engagement', () => {
  it('leaving an engaged melee foe provokes an opportunity attack', () => {
    const s = createState(setupFromPresets(1, 'solo', 'tutorial'));
    const [me, foe] = s.units;
    me!.pos = v(0, 0);
    foe!.pos = v(1, 0);
    me!.intent = { kind: 'attack', targetId: foe!.id, reason: 'attack' };
    foe!.intent = { kind: 'attack', targetId: me!.id, reason: 'attack' };
    updateEngagement(s);
    expect(me!.engagedWith).toBe(foe!.id);
    const hp = me!.hp;
    me!.pos = v(-1, 0);
    updateEngagement(s);
    expect(s.events.some((e) => e.type === 'opportunity')).toBe(true);
    expect(me!.hp).toBeLessThan(hp);
    expect(me!.engagedWith).toBeNull();
  });
  it('rolling away does not provoke', () => {
    const s = createState(setupFromPresets(1, 'solo', 'tutorial'));
    const [me, foe] = s.units;
    me!.pos = v(0, 0);
    foe!.pos = v(1, 0);
    me!.intent = { kind: 'attack', targetId: foe!.id, reason: 'attack' };
    updateEngagement(s);
    me!.pos = v(-1, 0);
    me!.forced = { vel: v(-6, 0), ticksLeft: 3, kind: 'roll' };
    updateEngagement(s);
    expect(s.events.some((e) => e.type === 'opportunity')).toBe(false);
  });
});
