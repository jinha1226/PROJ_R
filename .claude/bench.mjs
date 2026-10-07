import { chromium } from '@playwright/test';
const out = process.argv[2], base = process.argv[3] ?? 'http://localhost:4173/PROJ_R/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, vp] of [['land', { width: 1280, height: 720 }], ['port', { width: 412, height: 860 }]]) {
  const p = await b.newPage({ viewport: vp, hasTouch: name === 'port' });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`${base}?seed=3&rich&gear`);
  await p.getByText('깨어나기').click({ timeout: 60000 });
  await p.waitForSelector('.wh-top', { timeout: 90000 });
  await p.waitForFunction(() => document.querySelector('.place-prompts')?.textContent?.includes('작업장'), null, { timeout: 120000 }).catch(() => console.log('no prompt in time'));
  console.log(name, 'prompts:', (await p.locator('.place-prompts').innerText().catch(() => '?')).replace(/\n/g, ' / '));
  const btn = p.locator('.place-prompts [data-i]', { hasText: '작업장' });
  console.log(name, 'prompt', await btn.count());
  if (await btn.count()) { await btn.first().evaluate((el) => el.click()); await p.waitForTimeout(800); }
  const dis = p.locator('[data-act="dismantle"]').first();
  if (await dis.count()) { await dis.click(); await p.waitForTimeout(300); }
  await p.screenshot({ path: `${out}/bench-${name}.png` });
  console.log(name, (await p.locator('.wb').innerText().catch(() => '-')).slice(0, 200).replace(/\n/g, ' | '));
}
await b.close();
