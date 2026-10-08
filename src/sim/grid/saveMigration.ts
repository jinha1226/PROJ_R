import { legacyModStats } from './legacyModStats';
import { MODS, type ModSlot } from './mods';
import { stoneMod } from './stones';
import { savedMaterials } from './baseMigration';
import { ENGRAVE_IDS, type EngraveId } from './engraveCore';
import { makeWeapon, type Equipment } from './items';
import { ELEMENTS, validElements, type OfferCard } from './rounds';
import type { GridState } from './types';

export const savedIds = (v: unknown): EngraveId[] => Array.isArray(v)
  ? [...new Set(v.filter((id): id is EngraveId => ENGRAVE_IDS.includes(id as EngraveId)))] : [];
const equipment = <T extends Equipment>(item: T | null): T | null => {
  if (!item || item.kind !== 'weapon') return item;
  const group: string = item.group;
  return group === 'pistol' || group === 'shotgun' || group === 'rifle' ? makeWeapon('bow', 1) as T : item;
};
const card = (c: OfferCard): boolean => typeof c === 'string' ? ENGRAVE_IDS.includes(c)
  : !!c && c.kind === 'round' && ELEMENTS.includes(c.element);

/** Normalize removed content before any gameplay or UI code reads it. */
export function migrateRun(s: Pick<GridState, 'hero' | 'run' | 'records' | 'offers' | 'floorItems'>): void {
  s.run.stones = Array.isArray(s.run.stones) ? s.run.stones.filter(id => !!stoneMod(id)) : [];
  s.run.modsUnlocked = Array.isArray(s.run.modsUnlocked) ? s.run.modsUnlocked.filter(id => !!stoneMod(id)) : [];
  s.hero.perks = Array.isArray(s.hero.perks) ? s.hero.perks.filter(id => MODS.some(m => m.perk === id)) : [];
  if (!s.hero.baseMods && s.hero.modStats) s.hero.legacyMods ??= legacyModStats(s.hero.modStats);
  s.hero.baseMods = savedMods(s.hero.baseMods);
  s.hero.sockets = savedMods(s.hero.sockets, s.run.stones);
  s.run.materials = savedMaterials(s.run.materials);
  s.run.stock = savedMaterials(s.run.stock);
  s.run.tools ??= [];
  const h = s.hero, g = h.gear;
  h.arrows ??= 24;
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
    if ((f.item.kind as string) === 'echo') return [];
    if (f.item.kind === 'weapon' || f.item.kind === 'armor') {
      const item = equipment(f.item); return item ? [{ ...f, item }] : [];
    }
    if (f.item.kind === 'suit') f.item.ids = savedIds(f.item.ids);
    return [f];
  });
}

function savedMods(value: unknown, stones?: string[]): Partial<Record<ModSlot, string>> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([slot, id]) => typeof id === 'string'
    && (stones ? stoneMod(id)?.slot === slot && stones.includes(id) : MODS.some(m => m.id === id && m.slot === slot))));
}
