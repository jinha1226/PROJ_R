import { appendFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { compositions, summarize, type Run } from './delveBotRun';
import { botPool } from './delveBotPool';

describe('headless delve balance', () => {
  const runs: Run[] = [];
  const pool = botPool(Number(process.env.DELVE_BOT_WORKERS ?? 3));
  const seeds = Number(process.env.DELVE_BOT_SEEDS ?? 20);
  for (const comp of compositions) for (let seed = 1; seed <= seeds; seed++) {
    it.concurrent(`${comp.join('/')} seed ${seed} terminates without throwing`, async () => {
      const promise = pool.run(seed, comp);
      await expect(promise).resolves.toMatchObject({ end: expect.stringMatching(/^(wipe|general|floor5|timeout)$/) });
      const result = await promise;
      runs.push(result);
      if(process.env.DELVE_BOT_OUTPUT)appendFileSync(process.env.DELVE_BOT_OUTPUT,JSON.stringify(result)+'\n');
      console.log('DELVE_RUN', JSON.stringify(result));
    });
  }
  afterAll(async () => {
    runs.sort((a, b) => a.comp.localeCompare(b.comp) || a.seed - b.seed);
    console.log('DELVE_SUMMARY', JSON.stringify(summarize(runs)));
    await pool.close();
  });
});
