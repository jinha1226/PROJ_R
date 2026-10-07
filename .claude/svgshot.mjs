import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
const [file, out, w, h] = process.argv.slice(2);
const svg = readFileSync(file, 'utf8');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } });
// grid lines every 50 units so zones can be read off the drawing
const grid = Array.from({ length: 20 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="2000" stroke="#f0f" stroke-width="0.6"/><line x1="0" y1="${i * 50}" x2="2000" y2="${i * 50}" stroke="#f0f" stroke-width="0.6"/><text x="${i * 50 + 2}" y="10" fill="#ff0" font-size="9">${i * 50}</text><text x="2" y="${i * 50 + 10}" fill="#ff0" font-size="9">${i * 50}</text>`).join('');
await p.setContent(`<body style="margin:0;background:#000">${svg.replace('</svg>', grid + '</svg>').replace(/<svg /, `<svg style="width:${w}px;height:${h}px" `)}</body>`);
await p.screenshot({ path: out });
await b.close();
