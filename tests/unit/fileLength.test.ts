import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('sets the repository file length ceiling to 500', () => {
  expect(readFileSync('scripts/check-file-length.mjs', 'utf8')).toMatch(/const MAX = 500;/);
});
