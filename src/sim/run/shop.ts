import { createRng } from '../../core/rng';
import { getItem, ITEMS } from '../../data/items';
import type { Spot, RunState, ShopStock } from './types';

export const PRICE: Record<number, number> = { 0: 10, 1: 40, 2: 90, 3: 160, 4: 260 };
export const HEAL_COST = 30;
const STOCK = 5;

export function shopStock(run: RunState, node: Spot): ShopStock {
  const rng = createRng((run.seed * 6271 + node.step * 211 + node.lane * 3) >>> 0);
  const maxTier = Math.min(4, 1 + Math.floor(node.step / 3));
  const pool = Object.values(ITEMS).filter((i) => i.tier >= 1 && i.tier <= maxTier);
  return { items: rng.shuffle([...pool]).slice(0, STOCK).map((i) => ({ itemId: i.id, price: PRICE[i.tier]! })) };
}

export function buy(run: RunState, stock: ShopStock, index: number): { run: RunState; stock: ShopStock } {
  const it = stock.items[index];
  if (!it || it.sold) throw new Error('item not for sale');
  if (run.gold < it.price) throw new Error('not enough gold');
  return {
    run: { ...run, gold: run.gold - it.price, roster: { ...run.roster, inventory: [...run.roster.inventory, it.itemId] } },
    stock: { items: stock.items.map((x, i) => (i === index ? { ...x, sold: true } : x)) },
  };
}

export function sell(run: RunState, inventoryIndex: number): RunState {
  const id = run.roster.inventory[inventoryIndex];
  if (!id) throw new Error('nothing to sell');
  return {
    ...run, gold: run.gold + Math.floor(PRICE[getItem(id).tier]! / 2),
    roster: { ...run.roster, inventory: run.roster.inventory.filter((_, i) => i !== inventoryIndex) },
  };
}

export function healOne(run: RunState, mercId: string): RunState {
  if (!run.roster.mercs.some((m) => m.id === mercId && m.injury > 0)) throw new Error('nobody to heal');
  if (run.gold < HEAL_COST) throw new Error('not enough gold');
  return { ...run, gold: run.gold - HEAL_COST, roster: { ...run.roster, mercs: run.roster.mercs.map((m) => (m.id === mercId ? { ...m, injury: 0 } : m)) } };
}
