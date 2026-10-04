import { describe, it, expect } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { OPEN, sim, sureHits } from './kit';

const R = { x: 1, y: 0 };

describe('final review fixes (combos)', () => {
  it('a quick swap that also strikes is not free (no endless zero-time blows)', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.suit = ['quickswap', 'swapstrike'];
    g.s.hero.gear.hands = [makeWeapon('pistol', 1), makeWeapon('sword', 1)];
    g.s.hero.gear.active = 0;
    g.s.foes[0]!.hp = 99;
    const t = g.s.time;
    g.act({ kind: 'swap' });
    expect(g.s.foes[0]!.hp).toBeLessThan(99);
    expect(g.s.time - t).toBeCloseTo(0.5);
  });

  it('a plain (tap-walk) step toward a foe two cells ahead walks instead of dashing', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]);
    g.s.hero.suit = ['dash'];
    g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    g.s.hero.gear.active = 0;
    g.s.foes[0]!.hp = 99;
    g.act({ kind: 'move', dir: R, plain: true });
    expect(g.s.foes[0]!.hp).toBe(99);
    expect(g.s.hero.pos).toEqual({ x: 6, y: 7 });
  });

  it('shove-shot does not shove when the other hand cannot fire (no capacity for charge after the melee refill)', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.suit = ['shoveShot'];
    g.s.hero.gear.hands = [makeWeapon('sword', 1), makeWeapon('pistol', 1)];
    g.s.hero.gear.active = 0;
    g.s.hero.maxCharge = g.s.hero.charge = 0;
    g.s.foes[0]!.hp = 99;
    const ev = g.act({ kind: 'move', dir: R });
    expect(ev.some((e) => e.type === 'push')).toBe(false);
  });

  it('a leap, dash or kite never lands on the stairs (no floor change mid-fight)', () => {
    const leap = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(leap);
    leap.s.map.stairs = { x: 5, y: 7 };
    leap.s.hero.suit = ['leap'];
    leap.s.hero.gear.hands[0] = makeWeapon('axe', 1);
    leap.s.hero.gear.active = 0;
    leap.act({ kind: 'move', dir: R });
    expect(leap.s.run.floor).toBe(1);
    const dash = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]);
    dash.s.map.stairs = { x: 6, y: 7 };
    dash.s.hero.suit = ['dash'];
    dash.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    dash.s.hero.gear.active = 0;
    dash.s.foes[0]!.hp = 99;
    // a plain step onto the stairs is fine (going down on purpose); a dash there is not
    expect(dash.act({ kind: 'move', dir: R }).some((e) => e.type === 'engrave' && e.text === 'dash')).toBe(false);
    const kite = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(kite);
    kite.s.map.stairs = { x: 4, y: 7 };
    kite.s.hero.suit = ['kite'];
    kite.s.hero.gear.hands[0] = makeWeapon('pistol', 1);
    kite.s.hero.gear.active = 0;
    kite.s.hero.charge = 5;
    kite.s.foes[0]!.hp = 99;
    kite.act({ kind: 'shoot', target: kite.s.foes[0]!.id });
    expect(kite.s.run.floor).toBe(1);
    expect(kite.s.hero.pos).toEqual({ x: 5, y: 7 });
  });

  it('a level-up pick while frozen is still made at no time (the frozen turn is not spent on it)', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.hero.status = { burn: 0, freeze: 2, poison: 0 };
    g.s.offers = [['dash', 'leap', 'echo']];
    const t = g.s.time;
    g.act({ kind: 'choose', i: 0 });
    expect(g.s.offers).toHaveLength(0);
    expect(g.s.time).toBe(t);
  });
});
