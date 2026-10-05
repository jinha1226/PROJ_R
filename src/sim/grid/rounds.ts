import { PERK_BALANCE } from './perks';
import { hasPerk } from './mods';
import { fire, has, type EngraveId } from './engraveCore';
import type { Element } from './items';
import { applyElement } from './status';
import type { Ent, GridState, Hero } from './types';

export type Round = Element | 'plain';
export const ELEMENTS: Element[] = ['fire', 'frost', 'shock', 'poison'];
export const ROUND_NAMES: Record<Round, string> = { plain: '기본', fire: '화염', frost: '빙결', shock: '전격', poison: '독' };
export type OfferCard = EngraveId | { kind: 'round'; element: Element };
export const loadedRound = (h: Pick<Hero, 'rounds' | 'roundIdx'>): Element | undefined => h.rounds[h.roundIdx];
export const validElements = (v: unknown): Element[] => Array.isArray(v)
  ? [...new Set(v.filter((el): el is Element => ELEMENTS.includes(el as Element)))] : [];

/** The last card can be a round; keep the echo's first, locked engraving. */
export function withRoundOffer(s: GridState, ids: EngraveId[]): OfferCard[] {
  if (s.hero.rounds.length >= 2) return ids;
  const pool = ELEMENTS.filter(el => !s.hero.rounds.includes(el));
  const candidate = s.rng.pick<OfferCard>([...ids, ...pool.map(element => ({ kind: 'round' as const, element }))]);
  return typeof candidate === 'object' ? [...ids.slice(0, 2), candidate] : ids;
}
export function availableCard(s: GridState, card: OfferCard): boolean {
  return typeof card === 'string' ? !s.hero.suit.includes(card) : s.hero.rounds.length < 2 && !s.hero.rounds.includes(card.element);
}

/** Reserve the round before effects can recursively fire another shot. */
export function takeRound(s: GridState): { element?: Element; previous?: Element; third: boolean } {
  const h = s.hero, element = loadedRound(h), previous = h.fx.lastEl;
  h.fx.lastEl = element;
  h.roundIdx = h.rounds.length ? (h.roundIdx + 1) % h.rounds.length : 0;
  return { element, previous, third: ++h.fx.roundShots % 3 === 0 };
}
export function roundMult(s: GridState, t: number, round: ReturnType<typeof takeRound>): number {
  return s.hero.rounds.length === 2 && round.element && round.previous && round.element !== round.previous
    && has(s, 'alternate') && fire(s, t, 'alternate') ? 1.5 : 1;
}
export function inflictRound(s: GridState, t: number, foe: Ent, el: Element, engraving = false, shot = false): void {
  if (!foe.alive) return;
  // Radius zero preserves the existing entity reactions without laying fire under the victim.
  applyElement(s, t, el, foe.pos, 0, el === 'shock' ? [1, 2] : null, s.hero.id, undefined, s.hero.id, engraving, Number(shot && hasPerk(s.hero, 'elemChamber')) * PERK_BALANCE.statusStrength);
}
export function roundHit(s: GridState, t: number, foe: Ent, round: ReturnType<typeof takeRound>, engraving = false): void {
  if (!round.element || !foe.alive) return;
  inflictRound(s, t, foe, round.element, engraving, true);
  if (round.third && foe.alive && has(s, 'echo') && fire(s, t, 'echo')) inflictRound(s, t, foe, round.element, true, true);
}
export function bladeRound(s: GridState, t: number, foe: Ent): void {
  const el = loadedRound(s.hero);
  if (el && foe.alive && has(s, 'elemArrow') && fire(s, t, 'elemArrow')) inflictRound(s, t, foe, el, true);
}
