import { describe, it, expect } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { ENGRAVES } from '../../../src/sim/grid/engraveCore';
import { ENGRAVE_SLOTS, inscribe, offerFor, runeStone } from '../../../src/sim/grid/engrave';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { createRng } from '../../../src/core/rng';
import { handMap, OPEN, sim, sureHits } from './kit';
import { newState } from '../../../src/sim/grid/state';

describe('rune stones and inscribing', () => {
  it('a rune stone in the bag is inscribed on the weapon in hand for one turn and used up', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    g.s.hero.gear.bag = [runeStone('dash')];
    const t = g.s.time;
    const ev = g.act({ kind: 'inscribe', bag: 0 });
    expect(ev.some((e) => e.type === 'inscribe' && e.text === 'dash')).toBe(true);
    expect(g.s.hero.gear.hands[0]!.engraves).toEqual([{ id: 'dash', lvl: 1 }]);
    expect(g.s.hero.gear.bag).toHaveLength(0);
    expect(g.s.time - t).toBe(1);
  });

  it('a full weapon loses its oldest engraving; the same one again goes up a level (max 3)', () => {
    const w = makeWeapon('sword', 1);
    for (const id of ['dash', 'finisher'] as const) inscribe(w, id);
    expect(w.engraves).toHaveLength(ENGRAVE_SLOTS);
    inscribe(w, 'leap');
    expect(w.engraves!.map((e) => e.id)).toEqual(['finisher', 'leap']);
    for (let i = 0; i < 4; i++) inscribe(w, 'leap');
    expect(w.engraves!.find((e) => e.id === 'leap')!.lvl).toBe(3);
  });

  it('no weapon in hand, or not a rune stone: inscribing is refused', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.hero.gear.bag = [makeWeapon('axe', 1), runeStone('dash')];
    expect(g.act({ kind: 'inscribe', bag: 0 })[0]!.type).toBe('blocked');
    g.s.hero.gear.hands[g.s.hero.gear.active] = null;
    expect(g.act({ kind: 'inscribe', bag: 1 })[0]!.type).toBe('blocked');
  });

  it('a chest can hold a rune stone; with the bag full it is left on the floor, never lost', () => {
    const g = sim(['#######', '#.C...#', '#######'], { x: 1, y: 1 });
    sureHits(g);
    g.s.hero.gear.bag = Array.from({ length: 8 }, () => makeWeapon('dagger', 1));
    g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.floorItems.some((f) => f.item.kind === 'rune')).toBe(true);
  });

  it('each starting gun starts with one engraving on its first weapon', () => {
    for (const gun of ['pistol', 'shotgun', 'rifle'] as const) expect(GridSim.create(2, gun).s.hero.gear.hands[0]!.engraves).toHaveLength(1);
  });
});

describe('level-up choice', () => {
  it('offers three different engravings, mostly ones that suit the weapon in hand', () => {
    let suits = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = newState(handMap(OPEN), seed);
      s.rng = createRng(seed);
      s.hero.gear.hands[0] = makeWeapon('pistol', 1);
      s.hero.gear.active = 0;
      const offer = offerFor(s);
      expect(new Set(offer).size).toBe(3);
      for (const id of offer) { total++; if (['ranged', 'any'].includes(ENGRAVES[id].fits)) suits++; }
    }
    expect(suits / total).toBeGreaterThan(0.6);
  });

  it('a level gained queues an offer; choosing inscribes it on the weapon in hand at no time cost', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    g.s.hero.gear.active = 0;
    g.s.foes[0]!.hp = 1;
    g.s.hero.xp = 999;
    g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.offers.length).toBeGreaterThan(0);
    const pick = g.s.offers[0]![1]!;
    const left = g.s.offers.length;
    const t = g.s.time;
    const ev = g.act({ kind: 'choose', i: 1 });
    expect(ev.some((e) => e.type === 'inscribe' && e.text === pick)).toBe(true);
    expect(g.s.hero.gear.hands[0]!.engraves!.some((e) => e.id === pick)).toBe(true);
    expect(g.s.offers.length).toBe(left - 1);
    expect(g.s.time).toBe(t);
  });

  it('an offer can be passed up; with none pending choosing is refused', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.offers = [['dash', 'leap', 'echo']];
    g.act({ kind: 'choose', i: null });
    expect(g.s.offers).toHaveLength(0);
    expect(g.act({ kind: 'choose', i: 0 })[0]!.type).toBe('blocked');
  });

  it('a free action (quick swap, a choice) does not tick burning', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.hero.status = { burn: 3, freeze: 0, poison: 0 };
    g.s.offers = [['dash', 'leap', 'echo']];
    const hp = g.s.hero.hp;
    g.act({ kind: 'choose', i: 0 });
    expect(g.s.hero.hp).toBe(hp);
  });
});
