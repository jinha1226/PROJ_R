import { describe, it, expect } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { ENGRAVES } from '../../../src/sim/grid/engraveCore';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { offerFor } from '../../../src/sim/grid/engrave';
import { createRng } from '../../../src/core/rng';
import { handMap, OPEN, sim, sureHits } from './kit';
import { newState } from '../../../src/sim/grid/state';

describe('engraving and upgrade choices', () => {
  it('each starting gun has no engravings and the suit starts empty', () => {
    for (const gun of ['pistol', 'shotgun', 'rifle'] as const) {
      const { hero } = GridSim.create(2, gun).s;
      expect(hero.suit).toEqual([]);
      expect(hero.gear.hands[0]).not.toHaveProperty('engraves');
    }
  });

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

  it('levels gained queue upgrades; choosing consumes one at no time cost', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    g.s.hero.gear.active = 0;
    g.s.foes[0]!.hp = 1;
    g.s.hero.xp = 999;
    g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.upgrades).toHaveLength(14);
    expect(g.s.offers).toEqual([]);
    const pick = g.s.upgrades[0]![1]!;
    const left = g.s.upgrades.length;
    const t = g.s.time;
    const ev = g.act({ kind: 'upgrade', i: 1 });
    expect(ev.some((e) => e.type === 'upgrade' && e.text === pick)).toBe(true);
    expect(g.s.hero.suit).toEqual([]);
    expect(g.s.upgrades.length).toBe(left - 1);
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
