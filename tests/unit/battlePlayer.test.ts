import { describe, it, expect } from 'vitest';
import { BattlePlayer } from '../../src/view/playback/battlePlayer';
import { Battle } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';

const player = () => {
  let steps = 0;
  const p = new BattlePlayer(new Battle(setupFromPresets(1, 'standard', 'bandits')), () => { steps++; });
  return { p, steps: () => steps };
};

describe('battle player', () => {
  it('advances ticks proportional to speed', () => {
    const { p, steps } = player();
    p.speed = 1;
    p.update(0.05);
    p.update(0.05);
    expect(steps()).toBe(2);
    p.speed = 4;
    p.update(0.05);
    expect(steps()).toBe(6);
  });
  it('caps steps per frame after a long pause', () => {
    const { p, steps } = player();
    p.speed = 4;
    p.update(30);
    expect(steps()).toBeLessThanOrEqual(8);
    p.update(0.001);
    expect(steps()).toBeLessThanOrEqual(8);
  });
  it('speed 0 pauses', () => {
    const { p, steps } = player();
    p.speed = 0;
    p.update(1);
    expect(steps()).toBe(0);
  });
  it('reports interpolation alpha in [0,1)', () => {
    const { p } = player();
    p.speed = 1;
    const f = p.update(0.075);
    expect(f.alpha).toBeGreaterThanOrEqual(0);
    expect(f.alpha).toBeLessThan(1);
    expect(f.curr.tick).toBeGreaterThan(f.prev.tick);
  });
  it('retreat ends the battle on the next step', () => {
    const { p } = player();
    p.speed = 1;
    p.retreat();
    p.update(0.05);
    expect(p.battle.outcome).toBe('retreat');
  });
});
