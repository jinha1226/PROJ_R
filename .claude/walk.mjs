import { chromium } from '@playwright/test';
const out = process.argv[2], base = 'http://localhost:4173/PROJ_R/';
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await br.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`${base}?seed=3&lvl`); await p.click('[data-testid="to-grid"]', { timeout: 60000 });
await p.waitForSelector('.base-menu', { timeout: 60000 }); await p.waitForTimeout(4000);
for (let i = 0; i < 6; i++) { await p.screenshot({ path: `${out}/walk-${i}.png` }); await p.waitForTimeout(700); }
await br.close();
