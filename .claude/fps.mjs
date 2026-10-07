import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:4173/PROJ_R/', floor = process.argv[3] ?? '12';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, vp] of [['land', { width: 1280, height: 720 }], ['port', { width: 412, height: 860 }]]) {
  const p = await b.newPage({ viewport: vp });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`${base}?demo=deep&floor=${floor}&seed=3`);
  await p.waitForSelector('.wh-top', { timeout: 120000 });
  await p.waitForTimeout(6000);
  const r = await p.evaluate(() => new Promise((ok) => { const d = []; let last = performance.now(); const end = last + 6000; const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else { d.sort((a, b) => a - b); ok({ n: d.length, mean: d.reduce((a, b) => a + b, 0) / d.length, p95: d[Math.floor(d.length * 0.95)] }); } }; requestAnimationFrame(f); }));
  const actors = await p.evaluate(() => document.querySelectorAll('canvas').length);
  console.log(name, JSON.stringify(r), 'canvases', actors);
}
await b.close();
