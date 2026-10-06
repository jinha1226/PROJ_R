import { expect, it } from 'vitest';
import { card, KIND_NAME } from '../../src/sim/party/traitTypes';
import { traitText } from '../../src/sim/party/traitText';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { tagsOf } from '../../src/sim/party/classKit';
import { scene } from './support/cardScene';

it('a card with an upgrade has two ranks; its text gains the upgrade line at rank 2', () => {
  const c = card('x1', '시험', 'law', ['화염'], 'common', '처치하면 폭발', {}, '폭발이 폭발을 부름');
  TRAITS.x1 = c;
  expect(c.ranks).toBe(2); expect(KIND_NAME[c.kind!]).toBe('법칙');
  expect(traitText('x1', 1)).toBe('처치하면 폭발');
  expect(traitText('x1', 2)).toBe('처치하면 폭발 · 강화: 폭발이 폭발을 부름');
  expect(card('x0', '시험', 'amp', ['화염'], 'common', 't', {}).ranks).toBe(1);
  delete TRAITS.x1;
});

it('tags count one per card, whatever its rank', () => {
  const { u } = scene('mage');
  TRAITS.x2 = card('x2', '시험', 'law', ['화염'], 'common', 't', {}, 'u');
  u.traits = { x2: 2 }; u.gear = undefined;
  expect(tagsOf(u).화염).toBe(1);
  delete TRAITS.x2;
});
