import { expect, it } from 'vitest';
import { blinkOn, cardInfoHtml, cardLabel, cardMark, cardStripHtml, cardsLit, cardsOf } from '../../src/ui/overworld/cardStrip';
import { scene } from './support/cardScene';

it('every card has a short name for its tile: two or three letters, no space, no two alike; the full name is kept for everything else', async () => {
  const { TRAITS } = await import('../../src/sim/party/traitDefs');
  const { CARD_SHORT } = await import('../../src/ui/overworld/cardShort');
  const ids = Object.values(TRAITS).map((d) => d.id);
  expect(ids.filter((id) => !CARD_SHORT[id])).toEqual([]);
  expect(Object.keys(CARD_SHORT).filter((id) => !ids.includes(id))).toEqual([]);
  for (const s of Object.values(CARD_SHORT)) expect(s).toMatch(/^[가-힣]{2,3}$/);
  expect(new Set(Object.values(CARD_SHORT)).size).toBe(Object.keys(CARD_SHORT).length);
  expect(cardLabel('fireSpread')).toBe('전이'); expect(TRAITS.fireSpread!.name).toBe('화염 전이');
  // a card nobody named yet falls back to the head of its name's last word
  expect(cardMark('화염 전이')).toBe('전이'); expect(cardMark('블리자드')).toBe('블리');
});

it('the strip is two rows: the ultimate as a key, and under it every card held in one line, each by its short name', () => {
  const { p, u } = scene('mage');
  u.traits = { meteor: 2, fireSpread: 1, blizzard: 1 };
  expect(cardsOf(u)).toEqual(['meteor', 'fireSpread', 'blizzard']);
  const html = cardStripHtml(p, u.id);
  expect(html).toMatch(/^<div class="cs-ults"><button type="button" class="cs-ult[^"]*" data-skill="0" data-name="순간이동"><span>순간이동<\/span><\/button><\/div><div class="cs-cards">/);
  expect(html).toContain('data-card="fireSpread" title="화염 전이">전이<'); expect(html).toContain('data-card="blizzard" title="블리자드">눈보라<');
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

it('a card blinks every time it fires: lit, a beat dark, lit again; each rock of a meteor shower is a firing of the meteor card', () => {
  expect([0, 100, 200, 300, 400, 500].map(blinkOn)).toEqual([true, true, false, true, true, false]);
  const { u } = scene('mage');
  u.traits = { meteor: 1 };
  expect(cardsLit(u, '운석')).toEqual(['meteor']); expect(cardsLit(u, '운석 낙하')).toEqual(['meteor']);
});
