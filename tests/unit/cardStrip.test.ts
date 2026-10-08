import { expect, it } from 'vitest';
import { cardInfoHtml, cardMark, cardStripHtml, cardsLit, cardsOf } from '../../src/ui/overworld/cardStrip';
import { scene } from './support/cardScene';

it('a card is marked by the head of its name\'s last word', () => {
  expect(cardMark('화염 전이')).toBe('전이'); expect(cardMark('운석')).toBe('운석'); expect(cardMark('블리자드')).toBe('블리');
});

it('the strip shows the ultimate as a key and every card held, by name while they are few and by mark once they are many', () => {
  const { p, u } = scene('mage');
  u.traits = { meteor: 2, fireSpread: 1 };
  expect(cardsOf(u)).toEqual(['meteor', 'fireSpread']);
  const few = cardStripHtml(p, u.id);
  expect(few).toMatch(/^<div class="cs-ults"><button type="button" class="cs-ult[^"]*" data-skill="0" data-name="순간이동"><span>순간이동<\/span><\/button><\/div><div class="cs-cards few">/);
  expect(few).toContain('class="cs-cards few"'); expect(few).toContain('data-card="fireSpread" title="화염 전이">화염 전이<');
  u.traits = { meteor: 1, fireSpread: 1, fireball: 1, fireAmp: 1, blizzard: 1 };
  const many = cardStripHtml(p, u.id);
  expect(many).toContain('class="cs-cards"'); expect(many).toContain('data-card="fireSpread" title="화염 전이">전이<');
  // an ultimate cooling down shows the turns left
  u.souls![0]!.ultReady = p.time + 3;
  expect(cardStripHtml(p, u.id)).toMatch(/cs-ult wait[^>]*><span>순간이동<\/span><em>3<\/em>/);
});

it('an effect lights the card it belongs to: by the card\'s own name or by any of its triggers; an innate lights none', () => {
  const { u } = scene('mage');
  u.traits = { fireSpread: 1, blizzard: 3, frostPrison: 2 };
  expect(cardsLit(u, '화염 전이')).toEqual(['fireSpread']);
  // ice shards belong to both cards that can throw them
  expect(new Set(cardsLit(u, '얼음 파편'))).toEqual(new Set(['blizzard', 'frostPrison']));
  expect(cardsLit(u, '운석')).toEqual([]); expect(cardsLit(u, '원소 순환')).toEqual([]);
  expect(cardInfoHtml(u, 'blizzard')).toMatch(/^<b>블리자드 ★★★<\/b><span class="cs-info">/);
});
