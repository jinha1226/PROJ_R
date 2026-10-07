import { chromium } from '@playwright/test';
const out = process.argv[2], base = 'http://localhost:4173/PROJ_R/';
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await br.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`${base}?demo=tune`); await p.waitForSelector('.tune-ui', { timeout: 60000 }); await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/tune.png` });
await p.click('button[data-cls="rogue"]'); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/tune-rogue.png` });
await br.close();
