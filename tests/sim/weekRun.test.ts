import { describe, it, expect } from 'vitest';
import { playRun } from './support/weekBot';

describe('weekly run smoke', () => {
  it('a bot plays whole runs to an ending, every save round-trips, and the company grows', () => {
    for (const seed of [3, 11]) {
      const { run, weeks } = playRun(seed);
      expect(run.status === 'won' || run.status === 'lost', `seed ${seed} ended ${run.status}`).toBe(true);
      expect(weeks).toContain('explore');
      expect(run.roster.mercs.length + run.roster.memorial.length).toBeGreaterThan(1);
      expect(Math.max(...run.roster.mercs.map((m) => m.level), 0)).toBeGreaterThan(1);
    }
  });
});
