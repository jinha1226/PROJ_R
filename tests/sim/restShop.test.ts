import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { restHeal, restTalk } from '../../src/sim/run/rest';
import { shopStock, buy, sell, healOne, PRICE } from '../../src/sim/run/shop';
import { newRunV2 as newRun } from '../../src/sim/week/week';
import { generateRecruit } from '../../src/sim/roster/generate';
import { getItem } from '../../src/data/items';
import type { Spot, RunState } from '../../src/sim/run/types';

const run = (gold = 200): RunState => {
  const r = newRun(4, 'x');
  const rng = createRng(2);
  const used = new Set<string>();
  const extra = [1, 2].map((i) => ({ ...generateRecruit(rng, { level: 2, usedNames: used, id: `m${i}` }), injury: 2, traits: ['loner', 'cautious'] as const }));
  return { ...r, gold, roster: { ...r.roster, mercs: [...r.roster.mercs, ...extra.map((m) => ({ ...m, traits: [...m.traits] }))], inventory: ['knight_blade'] } };
};
const node = (): Spot => ({ step: 7, lane: 0 });

describe('rest', () => {
  it('heals everyone or lets two members talk', () => {
    expect(restHeal(run()).roster.mercs.every((m) => m.injury === 0)).toBe(true);
    const talked = restTalk(run(), 'm1', 'm2');
    expect(talked.roster.relations[0]!.affinity).toBe(12);
    const chatty = run();
    chatty.roster.mercs[1] = { ...chatty.roster.mercs[1]!, traits: ['chatty', 'calm'] };
    expect(restTalk(chatty, 'm1', 'm2').roster.relations[0]!.affinity).toBe(15);
  });
});

describe('shop', () => {
  it('stocks 5 priced items deterministically', () => {
    const r = run();
    const s = shopStock(r, node());
    expect(s.items).toHaveLength(5);
    expect(s).toEqual(shopStock(r, node()));
    for (const it of s.items) expect(it.price).toBe(PRICE[getItem(it.itemId).tier]);
  });
  it('buying spends gold and marks the item sold; short gold throws', () => {
    const r = run(1000);
    const s = shopStock(r, node());
    const out = buy(r, s, 0);
    expect(out.run.gold).toBe(1000 - s.items[0]!.price);
    expect(out.run.roster.inventory).toContain(s.items[0]!.itemId);
    expect(out.stock.items[0]!.sold).toBe(true);
    expect(() => buy(out.run, out.stock, 0)).toThrow();
    expect(() => buy({ ...r, gold: 0 }, s, 1)).toThrow();
  });
  it('sells at half price and heals for 30 gold', () => {
    const r = run(50);
    const sold = sell(r, 0);
    expect(sold.gold).toBe(50 + PRICE[3]! / 2);
    expect(sold.roster.inventory).toEqual([]);
    const healed = healOne(r, 'm1');
    expect(healed.gold).toBe(20);
    expect(healed.roster.mercs.find((m) => m.id === 'm1')!.injury).toBe(0);
    expect(() => healOne({ ...r, gold: 10 }, 'm1')).toThrow();
  });
});
