import { STARTER_KIT, X_ITEMS, xitem } from '../../data/extract';
import { mergeAll, putInto } from './inventory';

export const STASH_SLOTS = 40;
export const BUY_MULT = 2;

/** Always on sale: consumables (not the recall scroll) and tier 0–1 gear. */
export const MERCHANT_STOCK: string[] = Object.values(X_ITEMS)
  .filter((i) => (i.kind === 'consumable' && i.use?.kind !== 'recall') || (i.kind === 'gear' && i.tier <= 1))
  .sort((a, b) => (a.kind === b.kind ? a.value - b.value : a.kind === 'consumable' ? -1 : 1))
  .map((i) => i.id);

/** The free kit is worth nothing to the merchant (otherwise claim-and-sell prints gold). */
const STARTER = new Set([...Object.values(STARTER_KIT.weapon), STARTER_KIT.chest]);
export const sellPrice = (id: string): number => (STARTER.has(id) ? 0 : xitem(id).value);

/** Sells n (default all) of a stash stack at its value. */
type Purse = { gold: number; stash: { id: string; n: number }[] };

export function sell<T extends Purse>(p: T, stashIndex: number, n?: number): T {
  const s = p.stash[stashIndex];
  if (!s) throw new Error(`nothing at stash[${stashIndex}]`);
  const k = Math.min(s.n, n ?? s.n);
  const stash = s.n - k > 0 ? p.stash.map((x, i) => (i === stashIndex ? { id: x.id, n: x.n - k } : x)) : p.stash.filter((_, i) => i !== stashIndex);
  return { ...p, gold: p.gold + sellPrice(s.id) * k, stash };
}

/** Buys one into the stash at twice the value. */
export function buy<T extends Purse>(p: T, itemId: string): T {
  if (!MERCHANT_STOCK.includes(itemId)) throw new Error(`${itemId} is not for sale`);
  const cost = xitem(itemId).value * BUY_MULT;
  if (p.gold < cost) throw new Error('not enough gold');
  const r = putInto(p.stash, itemId, 1, STASH_SLOTS, () => true);
  if (!r.added) throw new Error('stash is full');
  return { ...p, gold: p.gold - cost, stash: r.list };
}

/** Banks stacks into the stash; may overflow past the slot limit (then sorties are blocked until sorted). */
export const bank = <T extends { stash: { id: string; n: number }[] }>(p: T, stacks: { id: string; n: number }[]): T => ({ ...p, stash: mergeAll(p.stash, stacks) });
