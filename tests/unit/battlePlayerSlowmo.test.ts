import { describe, it, expect } from 'vitest';
import { BattlePlayer } from '../../src/view/playback/battlePlayer';
import { Battle } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';

describe('battle player slow motion', () => {
  it('slows ticks during slow-mo and recovers afterwards', () => {
    let steps = 0;
    const p = new BattlePlayer(new Battle(setupFromPresets(1, 'standard', 'bandits')), () => { steps++; });
    p.speed = 1;
    p.slowmo(0.6, 0.25);
    for (let i = 0; i < 6; i++) p.update(0.1);
    const during = steps;
    expect(during).toBeLessThanOrEqual(4);
    for (let i = 0; i < 6; i++) p.update(0.1);
    expect(steps - during).toBeGreaterThanOrEqual(11);
  });
});
