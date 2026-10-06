import { expect, it } from 'vitest';
import { richText, whenText } from '../../src/ui/overworld/richText';

it('numbers go bold and keywords take their colour', () => {
  const html = richText('20% 확률로 대상에게 화상 3턴');
  expect(html).toContain('<b class="k-num">20%</b>');
  expect(html).toContain('<i class="k-fire">화상</i>');
  expect(html).toContain('<b class="k-num">3</b>턴');
});

it('conditions read "… 시", a few whole', () => {
  expect(whenText('적중')).toBe('적중 시');
  expect(whenText('제자리')).toBe('제자리 공격 시');
  expect(whenText('3번째 공격마다')).toBe('3번째 공격마다');
  expect(whenText('상시')).toBe('상시');
});
