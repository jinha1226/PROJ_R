import { ENGRAVE_IDS, type EngraveId } from './engraveCore';
import { makeWeapon, type Equipment } from './items';
import { ELEMENTS, validElements, type OfferCard } from './rounds';
import type { GridState } from './types';

export const savedIds = (v: unknown): EngraveId[] => Array.isArray(v)
  ? [...new Set(v.filter((id): id is EngraveId => ENGRAVE_IDS.includes(id as EngraveId)))] : [];
const equipment = <T extends Equipment>(item: T | null): T | null => {
  if (!item || item.kind !== 'weapon') return item;
  const group: string = item.group;
  if (group === 'staff') return null;
  return group === 'shotgun' || group === 'rifle' ? makeWeapon('pistol', 1) as T : item;
};
const card = (c: OfferCard): boolean => typeof c === 'string' ? ENGRAVE_IDS.includes(c)
  : !!c && c.kind === 'round' && ELEMENTS.includes(c.element);

/** Normalize removed content before any gameplay or UI code reads it. */
export function migrateRun(s: Pick<GridState, 'hero' | 'run' | 'records' | 'offers' | 'floorItems'>): void {
  const h = s.hero, g = h.gear;
  g.hands = [equipment(g.hands[0]), equipment(g.hands[1])];
  g.bag = g.bag.flatMap(item => { const migrated = equipment(item); return migrated ? [migrated] : []; });
  h.rounds = validElements(h.rounds).slice(0, 2);
  h.roundIdx = Number.isInteger(h.roundIdx) && h.roundIdx >= 0 && h.roundIdx < h.rounds.length ? h.roundIdx : 0;
  h.fx.roundShots ??= 0;
  h.suit = savedIds(h.suit);
  s.records = savedIds(s.records);
  for (const key of ['unlocked', 'tasted', 'recovered'] as const) if (s.run[key]) s.run[key] = savedIds(s.run[key]);
  if (s.run.leftSuit) s.run.leftSuit.ids = savedIds(s.run.leftSuit.ids);
  s.offers = s.offers.map(offer => offer.filter(card)).filter(offer => offer.length);
  s.floorItems = s.floorItems.flatMap(f => {
    if (f.item.kind === 'weapon' || f.item.kind === 'armor') {
      const item = equipment(f.item); return item ? [{ ...f, item }] : [];
    }
    if (f.item.kind === 'suit') f.item.ids = savedIds(f.item.ids);
    return [f];
  });
}
