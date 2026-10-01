import { describe, it, expect } from 'vitest';
import { playSortie, type SortieOutcome } from './support/sortieBot';

const rate = (rs: SortieOutcome[]) => rs.filter((r) => r.outcome === 'extracted').length / rs.length;

describe('sortie balance (bot with the free kit)', () => {
  it('leaving early is safer than staying late, and an early exit usually works', () => {
    const early = Array.from({ length: 8 }, (_, i) => playSortie(i + 1, 4));
    const late = Array.from({ length: 8 }, (_, i) => playSortie(i + 1, 11));
    expect(rate(early)).toBeGreaterThanOrEqual(0.5);
    expect(rate(early)).toBeGreaterThan(rate(late));
    expect(early.every((r) => r.outcome !== 'timeout')).toBe(true);
  }, 300_000);
});

/** BALANCE=1 npx vitest run tests/sim/sortieBalance.test.ts — the numbers recorded in docs/balance.md. */
describe.runIf(process.env.BALANCE === '1')('sortie balance report', () => {
  it('prints extraction rates by planned exit time', () => {
    const rows: string[] = [];
    for (const leave of [4, 6, 9, 11]) {
      const rs = Array.from({ length: 30 }, (_, i) => playSortie(i + 1, leave));
      const stayed = rs.filter((r) => r.minutes >= leave - 0.01);
      const ex = rs.filter((r) => r.outcome === 'extracted');
      rows.push(`leave ${leave}m: extracted ${Math.round(rate(rs) * 100)}% · stayed ${stayed.length}/30 → ${stayed.length ? Math.round((stayed.filter((r) => r.outcome === 'extracted').length / stayed.length) * 100) : 0}% · haul ${ex.length ? Math.round(ex.reduce((a, r) => a + r.value, 0) / ex.length) : 0}G · avg ${(rs.reduce((a, r) => a + r.minutes, 0) / 30).toFixed(1)}m`);
    }
    console.log(`\n${rows.join('\n')}`);
  }, 1_800_000);
});
