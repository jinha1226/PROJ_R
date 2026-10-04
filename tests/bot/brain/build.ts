import { ENGRAVES, SUIT_SLOTS, type EngraveId } from '../../../src/sim/grid/engraveCore';
import type { Family } from '../../../src/sim/grid/engraveDefs';
import { ELEMENTS, availableCard, type OfferCard } from '../../../src/sim/grid/rounds';
import type { GAction, GridState } from '../../../src/sim/grid/types';
import type { UpgradeId } from '../../../src/sim/grid/upgrades';

const STRONG: EngraveId[] = ['gunRelay', 'bladeRelay', 'momentum', 'flow', 'execute', 'cull', 'gale', 'tempest',
  'spinShot', 'barrage', 'quickdraw', 'thrift', 'reclaim', 'bloodlust', 'trance', 'bayonet'];
const WEAK: EngraveId[] = ['kite', 'wallslam', 'rebound', 'muzzleShove', 'shoulder', 'laststand'];
const CHARGE: EngraveId[] = ['reclaim', 'quickdraw', 'thrift', 'rebound', 'executionRush', 'fireEmber', 'shockCharge'];
const tier = (id: EngraveId) => STRONG.includes(id) ? 5 : WEAK.includes(id) ? 2 : 3;
export function archetype(s: GridState): Family {
  const counts: Record<Family, number> = { melee: 0, ranged: 0, fusion: 0, element: 0 };
  for (const id of s.hero.suit) counts[ENGRAVES[id].family] += tier(id);
  // Stable ties favour fusion, including the empty-suit campaign scoring context.
  return (['fusion', 'melee', 'ranged', 'element'] as Family[]).sort((a, b) => counts[b] - counts[a])[0]!;
}
export function scoreCard(s: GridState, card: OfferCard): number {
  const { suit, rounds } = s.hero;
  if (typeof card !== 'string') {
    if (rounds.includes(card.element) || rounds.length >= 2) return 0;
    return (rounds.length === 0 ? 6 : 4 + (suit.includes('alternate') ? 2 : 0))
      + suit.filter(id => id.startsWith(card.element)).length;
  }
  const def = ENGRAVES[card], family = archetype(s);
  const peers = suit.filter(id => id !== card);
  const element = ELEMENTS.find(el => card.startsWith(el));
  if (def.family === 'element' && (element ? !rounds.includes(element) : rounds.length < (card === 'alternate' ? 2 : 1))) return 0;
  let score = tier(card) + (def.family === family ? 2 : 0);
  if (peers.filter(id => ENGRAVES[id].family === def.family).length === 2) score += 3;
  if (def.family !== 'element') {
    for (const id of peers) score += def.tags.filter(tag => ENGRAVES[id].tags.includes(tag)).length;
    const tags = peers.flatMap(id => ENGRAVES[id].tags);
    if (tags.includes('처치') && ['momentum', 'gale', 'flow', 'fury'].includes(card)) score++;
    if (tags.includes('기절') && ['execute', 'executionRush'].includes(card)) score++;
  }
  if ((family === 'ranged' || family === 'fusion') && CHARGE.includes(card) && !peers.some(id => CHARGE.includes(id))) score += 2;
  return score;
}
export function pickOffer(s: GridState): Extract<GAction, { kind: 'choose' }> {
  const cards = (s.offers[0] ?? []).map((card, i) => ({ card, i, score: scoreCard(s, card) }))
    .filter(c => availableCard(s, c.card) && c.score > 0).sort((a, b) => b.score - a.score);
  const best = cards[0]; if (!best) return { kind: 'choose', i: null };
  if (typeof best.card !== 'string' || s.hero.suit.length < SUIT_SLOTS) return { kind: 'choose', i: best.i };
  const weakest = s.hero.suit.map((id, slot) => ({ slot, score: scoreCard(s, id) })).sort((a, b) => a.score - b.score)[0]!;
  return best.score > weakest.score + 1.5 ? { kind: 'choose', i: best.i, slot: weakest.slot } : { kind: 'choose', i: null };
}
const UPGRADE: Record<Family, Partial<Record<UpgradeId, number>>> = {
  melee: { meleeDmg: 4, killCharge: 3, hp: 3 }, ranged: { gunDmg: 4, charge: 3, hp: 2 },
  fusion: { killCharge: 4, gunDmg: 3, meleeDmg: 3 }, element: { gunDmg: 3, charge: 3 },
};
export function scoreUpgrade(s: GridState, id: UpgradeId): number {
  if (id === 'evasion') return s.hero.suit.filter(e => ENGRAVES[e].tags.includes('회피')).length >= 2 ? 4 : 1;
  return (UPGRADE[archetype(s)][id] ?? 1) + (id === 'hp' && s.hero.maxHp < 60 ? 2 : 0);
}
export function pickUpgrade(s: GridState): Extract<GAction, { kind: 'upgrade' }> {
  const best = (s.upgrades[0] ?? []).map((id, i) => ({ i, score: scoreUpgrade(s, id) })).sort((a, b) => b.score - a.score)[0];
  return { kind: 'upgrade', i: best?.i ?? null };
}
