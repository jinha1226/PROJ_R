import { describe, it } from 'vitest';
import { bossBattle, roomBattle, winRate } from './support/balanceKit';
import { playRun } from './support/weekBot';

/** BALANCE=1 npx vitest run tests/sim/balanceReport.test.ts — prints the full table. */
describe.runIf(process.env.BALANCE === '1')('balance report', () => {
  it('prints win rates by week and difficulty', () => {
    const rows: string[] = [];
    for (const week of [2, 5, 8, 11])
      for (const stars of [1, 2, 3] as const) {
        const r = winRate((s) => roomBattle(week, stars, s), 40);
        rows.push(`week ${week} ★${stars}: win ${(r.rate * 100).toFixed(0)}% avg ${r.avgSec.toFixed(1)}s`);
      }
    for (const week of [5, 8, 11]) rows.push(`week ${week} elite ★2: win ${(winRate((s) => roomBattle(week, 2, s, 'forest', true), 40).rate * 100).toFixed(0)}%`);
    rows.push(`boss: win ${(winRate((s) => bossBattle(s), 40).rate * 100).toFixed(0)}%`);
    let won = 0;
    for (let s = 1; s <= 40; s++) if (playRun(s).run.status === 'won') won++;
    rows.push(`weekly bot full runs: won ${won}/40`);
    console.log(`\n${rows.join('\n')}`);
  }, 600_000);
});
