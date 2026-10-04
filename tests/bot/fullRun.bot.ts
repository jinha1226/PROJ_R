import { it } from 'vitest';
import { runBot } from './runBot';
import { runCampaign } from './brain/campaign';

const SEEDS = Number(process.env.SEEDS ?? 20);
it('15-floor runs', () => {
  for (const god of [true, false]) for (const policy of ['naive', 'smart'] as const) {
    const rs = Array.from({ length: SEEDS }, (_, i) => runBot(1000 + i * 7, { god, policy }));
    console.log(`\n== ${policy} ${god ? 'god' : 'real'} ==`);
    for (const r of rs) console.log(`seed ${r.seed} ${r.outcome.padEnd(7)} f${r.floor} lv${r.level} kills ${r.kills} acts ${r.actions}`
      + ` potions ${r.potions} scrolls ${r.scrolls} belt ${r.belt}${r.killedBy ? ` by ${r.killedBy}` : ''}`
      + `${r.stuck ? ` STUCK ${r.stuck}` : ''} build [${r.build.join(',')}]`);
    const won = rs.filter(r => r.outcome === 'won').length;
    const avg = rs.reduce((a, r) => a + r.floor, 0) / rs.length;
    console.log(`SUMMARY ${policy} ${god ? 'god' : 'real'}: won ${won}/${rs.length}, avg floor ${avg.toFixed(2)},`
      + ` best ${Math.max(...rs.map(r => r.floor))}, stuck ${rs.filter(r => r.outcome === 'stuck').length}`);
  }
});
it('campaign with persistent meta', () => {
  const campaign = runCampaign(1000);
  for (const r of campaign.runs) console.log(`campaign ${r.index} seed ${r.seed} ${r.outcome} f${r.floor}`
    + ` by ${r.killedBy ?? '-'} build [${r.build.join(',')}] energy ${r.metaAfter.energy}`
    + ` materials ${JSON.stringify(r.materials)} repairs [${r.repairs.join(',')}] unlocked ${r.unlocked}`
    + `${r.stuck ? ` STUCK ${r.stuck}` : ''}`);
  console.log(`SUMMARY campaign: runs ${campaign.runs.length}, won ${campaign.runs.filter(r => r.outcome === 'won').length},`
    + ` first win ${campaign.firstWin ?? 'none'}, best floor ${campaign.bestFloor}, last 10 avg floor ${campaign.last10Average.toFixed(2)}`);
});
