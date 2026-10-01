import { describe, it, expect } from 'vitest';
import { runHeadless } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';

describe('determinism', () => {
  for (const [a, e] of [['standard', 'bandits'], ['elemental', 'skeletons'], ['standard', 'boss']] as const) {
    it(`${a} vs ${e} replays identically`, () => {
      const r1 = runHeadless(setupFromPresets(1234, a, e));
      const r2 = runHeadless(setupFromPresets(1234, a, e));
      expect(JSON.stringify(r1.events)).toBe(JSON.stringify(r2.events));
      expect(r1.outcome).toBe(r2.outcome);
    });
  }
  it('different seeds diverge', () => {
    const r1 = runHeadless(setupFromPresets(1, 'standard', 'bandits'));
    const r2 = runHeadless(setupFromPresets(2, 'standard', 'bandits'));
    expect(JSON.stringify(r1.events)).not.toBe(JSON.stringify(r2.events));
  });
});
