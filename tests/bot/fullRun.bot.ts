import { it } from 'vitest';
import { runBot } from './runBot';

const SEEDS = Number(process.env.SEEDS ?? 20);
it('15-floor runs', () => {
  for (const god of [true, false]) {
    const rs = Array.from({ length: SEEDS }, (_, i) => runBot(1000 + i * 7, god));
    console.log(`\n== ${god ? 'god' : 'real'} ==`);
    for (const r of rs) console.log(`seed ${r.seed} ${r.outcome.padEnd(7)} f${r.floor} lv${r.level} kills ${r.kills} acts ${r.actions}${r.killedBy ? ` by ${r.killedBy}` : ''}${r.stuck ? ` STUCK ${r.stuck}` : ''}`);
    const won = rs.filter((r) => r.outcome === 'won').length;
    const floors = rs.map((r) => r.floor);
    console.log(`won ${won}/${rs.length}, avg floor ${(floors.reduce((a, b) => a + b, 0) / rs.length).toFixed(1)}`);
  }
});
