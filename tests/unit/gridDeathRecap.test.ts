import { expect, it } from 'vitest';
import { deathLine } from '../../src/ui/grid/deathRecap';
it.each([
  ['minion', false, '해골 졸개'], ['brute', true, '정예 해골 전사'],
  ['archer', false, '해골 석궁병'], ['ghoul', false, '구울'],
  ['mage', false, '해골 마법사'], ['champion', false, '해골 챔피언'],
  ['trap', false, '함정'], ['burn', false, '화상'], ['poison', false, '중독'],
  ['blast', false, '폭발'], ['self', false, '자신'],
] as const)('names %s in Korean', (kind, elite, name) => {
  expect(deathLine({ kind, elite })).toBe(`쓰러뜨린 것: ${name}`);
});
it('has a Korean fallback', () => { expect(deathLine()).toBe('쓰러뜨린 것: 자신'); });
