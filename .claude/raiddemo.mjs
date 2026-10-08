import { chromium } from '@playwright/test';
const out = process.argv[2], n = process.argv[3] ?? '60', base = 'http://localhost:4173/PROJ_R/';
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await br.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`${base}?demo=raid&n=${n}`); await p.waitForSelector('.ult-bar', { timeout: 90000 });
for (const s of [6, 14, 24]) { await p.waitForTimeout(s === 6 ? 6000 : (s - (s === 14 ? 6 : 14)) * 1000); await p.screenshot({ path: `${out}/raid-${n}-${s}.png` }); }
console.log(await p.locator('.raid-bar').innerText().catch(() => ''));
await br.close();
