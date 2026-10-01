import { describe, it, expect } from 'vitest';
import { playSortie, type SortieOutcome } from './support/sortieBot';

const rate = (rs: SortieOutcome[]) => rs.filter((r) => r.outcome === 'extracted').length / rs.length;
const avg = (rs: SortieOutcome[], f: (r: SortieOutcome) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length;

describe('party sortie balance (bot, free kit)', () => {
  it('leaving early is safer than staying late, and an early exit usually works', () => {
    const early = Array.from({ length: 8 }, (_, i) => playSortie(i + 1, 4, 3));
    const late = Array.from({ length: 8 }, (_, i) => playSortie(i + 1, 11, 3));
    expect(rate(early)).toBeGreaterThanOrEqual(0.5);
    expect(rate(early)).toBeGreaterThan(rate(late));
    expect(avg(late, (r) => r.dead)).toBeGreaterThan(avg(early, (r) => r.dead));
    expect(early.every((r) => r.outcome !== 'timeout')).toBe(true);
  }, 300_000);
});

/** BALANCE=1 npx vitest run tests/sim/sortieBalance.test.ts — the numbers recorded in docs/balance.md. */
describe.runIf(process.env.BALANCE === '1')('party sortie balance report', () => {
  it('prints extraction, losses and haul by party size and planned exit time', () => {
    const rows: string[] = [];
    for (const size of [3, 5])
      for (const leave of [4, 7, 11]) {
        const rs = Array.from({ length: 30 }, (_, i) => playSortie(i + 1, leave, size));
        const ex = rs.filter((r) => r.outcome === 'extracted');
        rows.push(`party ${size} · leave ${leave}m: extracted ${Math.round(rate(rs) * 100)}% · home ${avg(rs, (r) => r.home).toFixed(1)} · dead ${avg(rs, (r) => r.dead).toFixed(1)} · haul ${ex.length ? Math.round(avg(ex, (r) => r.value)) : 0}G · avg ${avg(rs, (r) => r.minutes).toFixed(1)}m`);
      }
    console.log(`\n${rows.join('\n')}`);
  }, 1_800_000);
});
