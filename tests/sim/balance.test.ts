import { describe, it, expect } from 'vitest';
import { runHeadless } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';

const sweep = (a: string, e: string, n: number) => {
  let wins = 0;
  let maxTicks = 0;
  let under90 = 0;
  const kinds = new Set<string>();
  for (let seed = 0; seed < n; seed++) {
    const r = runHeadless(setupFromPresets(seed, a, e));
    if (r.outcome === 'victory') wins++;
    maxTicks = Math.max(maxTicks, r.ticks);
    if (r.ticks <= 90 * 20) under90++;
    r.events.forEach((x) => kinds.add(x.type));
  }
  return { rate: wins / n, maxTicks, under90: under90 / n, kinds };
};

describe('balance smoke', () => {
  it('standard party beats bandits most of the time, quickly', () => {
    const r = sweep('standard', 'bandits', 60);
    expect(r.rate).toBeGreaterThanOrEqual(0.6);
    expect(r.under90).toBeGreaterThanOrEqual(0.8);
  });
  it('lone novice vs tutorial is winnable but not free', () => {
    const r = sweep('solo', 'tutorial', 60);
    expect(r.rate).toBeGreaterThanOrEqual(0.3);
    expect(r.rate).toBeLessThanOrEqual(0.97);
  });
  it('every battle terminates and exercises core mechanics', () => {
    const r = sweep('elemental', 'skeletons', 40);
    expect(r.maxTicks).toBeLessThanOrEqual(300 * 20);
    for (const k of ['damage', 'downed', 'tag_add', 'telegraph_fire', 'projectile', 'intent', 'combo', 'heal'])
      expect(r.kinds.has(k), k).toBe(true);
  });
  it('boss fight terminates', () => {
    expect(sweep('standard', 'boss', 10).maxTicks).toBeLessThanOrEqual(300 * 20);
  });
});
