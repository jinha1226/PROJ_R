import { expect, it } from 'vitest';
import { foeName } from '../../src/ui/grid/foeNames';
import { deathLine } from '../../src/ui/grid/deathRecap';

it('each zone names its own folk', () => {
  expect(foeName('minion', 1)).toBe('고블린');
  expect(foeName('champion', 5)).toBe('고블린 족장');
  expect(foeName('minion', 6)).toBe('해골 졸개');
  expect(foeName('brute', 11)).toBe('오크 광전사');
  expect(foeName('ghoul', 12)).toBe('구울');
});

it('the death line names the killer of that floor', () => {
  expect(deathLine({ kind: 'brute', elite: true }, 2)).toBe('쓰러뜨린 것: 정예 홉고블린');
  expect(deathLine({ kind: 'trap' }, 14)).toBe('쓰러뜨린 것: 함정');
});
