import { describe, it, expect } from 'vitest';
import { runHeadless } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';

describe('bonds preset smoke', () => {
  it('relationship behaviors actually happen across seeds and every battle ends', () => {
    const triggers = new Map<string, number>();
    let emotions = 0;
    let combos = 0;
    let wins = 0;
    for (let seed = 0; seed < 40; seed++) {
      const r = runHeadless(setupFromPresets(seed, 'bonds', 'ambush'));
      expect(r.ticks).toBeLessThanOrEqual(300 * 20);
      if (r.outcome === 'victory') wins++;
      for (const e of r.events) {
        if (e.type === 'relation_trigger') triggers.set(String(e.data?.kind), (triggers.get(String(e.data?.kind)) ?? 0) + 1);
        if (e.type === 'emotion') emotions++;
        if (e.type === 'pair_combo') combos++;
      }
    }
    expect((triggers.get('protect') ?? 0) + (triggers.get('mentor') ?? 0)).toBeGreaterThan(0);
    expect(triggers.get('rivalry') ?? 0).toBeGreaterThan(0);
    expect(emotions).toBeGreaterThan(0);
    expect(combos).toBeGreaterThan(0);
    expect(triggers.get('revenge') ?? 0).toBeGreaterThan(0);
    expect(triggers.get('courage') ?? 0).toBeGreaterThan(0);
    expect(wins).toBeGreaterThan(4);
    expect(wins).toBeLessThan(36);
  });
});
