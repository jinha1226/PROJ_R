import { appendFileSync, writeFileSync, writeSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playGridRun, type GridBotMode, type GridBotResult } from './support/gridBot';

export const BALANCE_SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
// Linear interpolation (R type 7); deaths only, excluding wins and capped runs.
function quantile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b), at = (sorted.length - 1) * p;
  const lo = Math.floor(at), hi = Math.ceil(at);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}
function report(mode: GridBotMode, runs: GridBotResult[]) {
  const deaths = runs.filter(r => r.outcome === 'dead');
  const floors = deaths.map(r => r.floor);
  const sight = runs.reduce((n, r) => n + r.sightTurns, 0);
  const empty = runs.reduce((n, r) => n + r.emptyChargeTurns, 0);
  return {
    bot: mode, seeds: runs.length, 'win %': 100 * runs.filter(r => r.outcome === 'won').length / runs.length,
    'death Q1': quantile(floors, 0.25), 'death median': quantile(floors, 0.5), 'death Q3': quantile(floors, 0.75),
    'deaths 1–5': deaths.filter(r => r.floor <= 5).length,
    'deaths 6–10': deaths.filter(r => r.floor >= 6 && r.floor <= 10).length,
    'deaths 11–15': deaths.filter(r => r.floor >= 11).length,
    'avg turns': +mean(runs.map(r => r.turns)).toFixed(1),
    'avg death level': +mean(deaths.map(r => r.level)).toFixed(2),
    'empty/sight turns': `${empty}/${sight}`, 'empty %': +(100 * empty / (sight || 1)).toFixed(2),
    capped: runs.filter(r => r.outcome === 'cap').length,
  };
}

describe.skipIf(process.env.BALANCE !== '1')('grid balance report (fresh meta, seeds 1–40)', () => {
  it('runs both fixed policies and reports all outcomes', () => {
    const output = process.env.BALANCE_REPORT;
    if (output) writeFileSync(output, '');
    const rows = (['decent', 'pistol-only'] as const).map(mode => {
      const runs = BALANCE_SEEDS.map(seed => {
        const result = playGridRun(seed, mode);
        if (output) appendFileSync(output, JSON.stringify(result) + '\n');

        return result;
      });
      return report(mode, runs);
    });
    if (output) appendFileSync(output, JSON.stringify({ summary: rows }) + '\n');
    const keys = Object.keys(rows[0]!);
    writeSync(1, '\n| ' + keys.join(' | ') + ' |\n| ' + keys.map(() => '---').join(' | ') + ' |\n');
    for (const row of rows) writeSync(1, '| ' + Object.values(row).join(' | ') + ' |\n');
    expect(rows.every(r => r.capped === 0)).toBe(true);
    const [decent, pistol] = rows;
    expect.soft(decent!['win %']).toBeGreaterThanOrEqual(10);
    expect.soft(decent!['win %']).toBeLessThanOrEqual(25);
    expect.soft(decent!['death median']).toBeGreaterThanOrEqual(6);
    expect.soft(decent!['death median']).toBeLessThanOrEqual(10);
    for (const zone of ['deaths 1–5', 'deaths 6–10', 'deaths 11–15'] as const) expect.soft(decent![zone]).toBeGreaterThan(0);
    expect.soft(pistol!['win %']).toBe(0);
    expect.soft(pistol!['death median']).toBeLessThanOrEqual(5);
  }, 300_000);
});
