import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const MAX = 400;
const ROOTS = ['src', 'tests', 'scripts'];
const EXT = new Set(['.ts', '.js', '.mjs', '.css']);
const bad = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXT.has(extname(p))) {
      const n = readFileSync(p, 'utf8').split('\n').length;
      if (n > MAX) bad.push(`${p}: ${n} lines`);
    }
  }
};
for (const r of ROOTS) {
  try { walk(r); } catch { /* root may not exist yet */ }
}
if (bad.length) {
  console.error(`Files over ${MAX} lines:\n${bad.join('\n')}`);
  process.exit(1);
}
console.log('file length OK');
