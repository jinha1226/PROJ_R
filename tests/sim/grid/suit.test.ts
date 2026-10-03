import { describe, expect, it } from 'vitest';
import { ENGRAVE_IDS, fitsHand, has, SUIT_SLOTS } from '../../../src/sim/grid/engraveCore';
import { offerFor, putOnSuit } from '../../../src/sim/grid/engrave';
import { makeWeapon, type WeaponGroup } from '../../../src/sim/grid/items';
import type { GAction } from '../../../src/sim/grid/types';
import { OPEN, sim, sureHits } from './kit';

describe('suit engravings', () => {
  it('starts empty and activates only the fitting family, with any always active', () => {
    const { s } = sim(OPEN, { x: 3, y: 3 });
    expect(s.hero.suit).toEqual([]);
    s.hero.suit = ['dash', 'rapid', 'momentum', 'chain'];
    for (const group of ['sword', 'pistol', 'staff', null] as const) {
      s.hero.gear.hands[0] = group ? makeWeapon(group, 1) : null;
      expect(has(s, 'dash')).toBe(group === 'sword');
      expect(has(s, 'rapid')).toBe(group === 'pistol');
      expect(has(s, 'chain')).toBe(group === 'staff');
      expect(has(s, 'momentum')).toBe(true);
      expect(has(s, 'laststand')).toBe(false);
      expect(fitsHand(s, 'laststand')).toBe(true);
    }
  });

  it('fills six slots, ignores slot while free, and requires a valid replacement without duplicates', () => {
    const { s } = sim(OPEN, { x: 3, y: 3 });
    for (const id of ENGRAVE_IDS.slice(0, 6)) expect(putOnSuit(s, id, 99)).toBe(true);
    expect(s.hero.suit).toHaveLength(SUIT_SLOTS);
    const id = ENGRAVE_IDS[6]!;
    for (const slot of [undefined, -1, 6, 1.5, NaN]) expect(putOnSuit(s, id, slot)).toBe(false);
    expect(putOnSuit(s, id, 2)).toBe(true);
    expect(s.hero.suit[2]).toBe(id);
    expect(putOnSuit(s, id, 0)).toBe(false);
    for (let n = 0; n < 50; n++) expect(offerFor(s).every((x) => !s.hero.suit.includes(x))).toBe(true);
  });

  it('blocks a full-suit choice without consuming the offer, then replaces for no time', () => {
    const g = sim(OPEN, { x: 3, y: 3 });
    g.s.hero.suit = ENGRAVE_IDS.slice(0, 6);
    g.s.offers = [['momentum', 'quickswap', 'swapstrike']];
    expect(g.act({ kind: 'choose', i: 0 })[0]!.type).toBe('blocked');
    expect(g.s.offers).toHaveLength(1);
    g.act({ kind: 'choose', i: 0, slot: 2 });
    expect(g.s.hero.suit[2]).toBe('momentum');
    expect(g.s.offers).toHaveLength(0);
    expect(g.s.hero.nextAt).toBe(0);
  });

  it.each(['pistol', 'axe'] as const)('quickswap from %s to sword charges only a family change', (from) => {
    const g = sim(OPEN, { x: 3, y: 3 }, [{ kind: 'brute', pos: { x: 4, y: 3 } }]);
    sureHits(g);
    g.s.foes[0]!.nextAt = 100;
    g.s.hero.suit = ['quickswap'];
    g.s.hero.gear.hands = [makeWeapon(from, 1), makeWeapon('sword', 1)];
    g.act({ kind: 'swap' });
    expect(g.s.hero.nextAt).toBe(from === 'pistol' ? 0 : 0.5);
    expect(g.s.hero.fx.nextMult).toBe(from === 'pistol' ? 1.5 : 1);
    const hits = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(hits.find((e) => e.type === 'hit' && e.src === 'hero')?.amount).toBe(from === 'pistol' ? 9 : 6);
    expect(g.s.hero.fx.nextMult).toBe(1);
  });

  it('swapstrike keeps the half-turn cost even without a target or with an empty hand', () => {
    const g = sim(OPEN, { x: 3, y: 3 });
    g.s.hero.suit = ['quickswap', 'swapstrike'];
    g.act({ kind: 'swap' });
    expect(g.s.hero.nextAt).toBe(0.5);
  });

  it.each([
    ['sword', 'pistol', 0], ['staff', 'pistol', 0], ['pistol', 'staff', 0],
    ['staff', 'staff', 0.5], ['pistol', 'rifle', 0.5], [null, 'sword', 0.5], ['sword', null, 0.5],
  ] as [WeaponGroup | null, WeaponGroup | null, number][])('quickswap %s to %s costs %s', (from, to, cost) => {
    const g = sim(OPEN, { x: 3, y: 3 });
    g.s.hero.suit = ['quickswap'];
    g.s.hero.gear.hands = [from ? makeWeapon(from, 1) : null, to ? makeWeapon(to, 1) : null];
    g.act({ kind: 'swap' });
    expect(g.s.hero.nextAt).toBe(cost);
    expect(g.s.hero.fx.nextMult).toBe(cost === 0 ? 1.5 : 1);
  });

  it('can choose while empty-handed, drops duplicate queued choices, and can skip a full suit', () => {
    const g = sim(OPEN, { x: 3, y: 3 });
    g.s.hero.gear.hands = [null, null];
    g.s.offers = [['dash'], ['dash']];
    g.act({ kind: 'choose', i: 0, slot: 99 });
    expect(g.s.hero.suit).toEqual(['dash']);
    // the second offer held only the card just taken: it is gone
    expect(g.s.offers).toEqual([]);
    g.s.offers = [['leap']];
    g.s.hero.suit = ENGRAVE_IDS.slice(0, 6);
    g.act({ kind: 'choose', i: null });
    expect(g.s.offers).toEqual([]);
    expect(g.s.hero.suit).toEqual(ENGRAVE_IDS.slice(0, 6));
    expect(g.s.hero.nextAt).toBe(0);
  });

  it('chests never give rune stones and the removed inscribe action is refused', () => {
    for (let seed = 0; seed < 50; seed++) {
      const g = sim(['#####', '#.C.#', '#####'], { x: 1, y: 1 }, [], seed);
      g.act({ kind: 'move', dir: { x: 1, y: 0 } });
      expect([...g.s.hero.gear.bag, ...g.s.floorItems.map((f) => f.item)].some((e) => String(e.kind) === 'rune')).toBe(false);
    }
    const g = sim(OPEN, { x: 3, y: 3 });
    expect(g.act({ kind: 'inscribe', bag: 0 } as unknown as GAction)[0]!.type).toBe('blocked');
    expect(g.s.hero.nextAt).toBe(0);
  });
});
