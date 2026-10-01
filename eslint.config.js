import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const PURE = ['src/core/**', 'src/data/**', 'src/sim/**'];
const VIEW_LAYERS = { group: ['**/app/**', '**/view/**', '**/ui/**'], message: 'pure layer: no app/view/ui' };
const THREE = { group: ['three', 'three/*'], message: 'pure layer: no three.js' };

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'test-artifacts', '.asset-cache', 'playwright-report', '.superpowers'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: PURE,
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': ['error', { patterns: [THREE, VIEW_LAYERS] }],
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'use core/rng' },
        { object: 'Date', property: 'now', message: 'sim must be deterministic' }],
      'no-restricted-globals': ['error', 'window', 'document', 'performance'],
    },
  },
  { files: ['src/core/**'], rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/data/**', '**/sim/**', '**/app/**', '**/view/**', '**/ui/**', 'three'], message: 'core imports nothing' }] }] } },
  { files: ['src/data/**'], rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/sim/**', '**/app/**', '**/view/**', '**/ui/**', 'three'], message: 'data imports only core' }] }] } },
);
