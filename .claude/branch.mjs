import { chromium } from '@playwright/test';
const out = process.argv[2], b = process.argv[3] ?? 'shell:blast', base = 'http://localhost:4173/PROJ_R/';
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await br.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`${base}?demo=branch`); await p.waitForSelector('.branch-menu'); await p.screenshot({ path: `${out}/branch-menu.png` });
await p.goto(`${base}?demo=branch&b=${b}`); await p.waitForSelector('.wh-top', { timeout: 120000 });
for (let i = 0; i < 6; i++) { await p.waitForTimeout(2500); const n = p.locator('.step-next'); if (await n.count()) await n.first().click().catch(() => {}); }
await p.screenshot({ path: `${out}/branch-${b.replace(':', '-')}.png` });
console.log('log', (await p.locator('.wh-log').innerText()).split('\n').slice(-6).join(' | '));
await br.close();
