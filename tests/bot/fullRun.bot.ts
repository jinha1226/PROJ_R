import { it } from 'vitest';
import { runBot, type BotResult } from './runBot';
import { runCampaign } from './brain/campaign';

const SEEDS = Number(process.env.SEEDS ?? 20);
const stones = (r: BotResult) => ` stones ${r.stonesFound.length}/${r.stonesSocketed.length}/${r.stonesBanked.length} portals [${r.portalsOpened.join(',')}]`;
function summary(label: string, rs: BotResult[]): string {
  const count = (outcome: string) => rs.filter(r => r.outcome === outcome).length;
  const sum = (key: 'stonesFound' | 'stonesSocketed' | 'stonesBanked' | 'portalsOpened') => rs.reduce((n, r) => n + r[key].length, 0);
  return `SUMMARY ${label}: runs ${rs.length}, won ${count('won')}, returned ${count('returned')}, dead ${count('dead')},`
    + ` safe ${rs.filter(r => r.safeEnd).length}, avg floor ${(rs.reduce((a, r) => a + r.floor, 0) / rs.length).toFixed(2)},`
    + ` best ${Math.max(...rs.map(r => r.floor))}, stuck ${count('stuck')}, timeout ${count('timeout')},`
    + ` stones found/socketed/banked ${sum('stonesFound')}/${sum('stonesSocketed')}/${sum('stonesBanked')}, portals ${sum('portalsOpened')}`;
}
it('15-floor runs', () => {
  for (const god of [true, false]) for (const policy of ['naive', 'smart'] as const) {
    const rs = Array.from({ length: SEEDS }, (_, i) => runBot(1000 + i * 7, { god, policy }));
    console.log(`\n== ${policy} ${god ? 'god' : 'real'} ==`);
    for (const r of rs) console.log(`seed ${r.seed} ${r.outcome.padEnd(7)} f${r.floor} lv${r.level} kills ${r.kills} acts ${r.actions}`
      + ` potions ${r.potions} scrolls ${r.scrolls} belt ${r.belt}${r.killedBy ? ` by ${r.killedBy}` : ''}${stones(r)}`
      + `${r.stuck ? ` STUCK ${r.stuck}` : ''} build [${r.build.join(',')}]`);
    console.log(summary(`${policy} ${god ? 'god' : 'real'}`, rs));
  }
});
it('campaign with persistent meta', () => {
  for (const startDeep of [false, true]) {
    const label = startDeep ? 'deepest' : 'always-1', campaign = runCampaign(1000, 30, { startDeep });
    for (const r of campaign.runs) console.log(`campaign ${label} ${r.index} seed ${r.seed} ${r.outcome} f${r.floor}`
      + ` by ${r.killedBy ?? '-'} build [${r.build.join(',')}] energy ${r.metaAfter.energy}${stones(r)}`
      + ` materials ${JSON.stringify(r.materials)} repairs [${r.repairs.join(',')}] unlocked ${r.unlocked}`
      + `${r.stuck ? ` STUCK ${r.stuck}` : ''}`);
    console.log(summary(`campaign ${label}`, campaign.runs)
      + `, first win ${campaign.firstWin ?? 'none'}, last 10 avg floor ${campaign.last10Average.toFixed(2)}`);
  }
});
