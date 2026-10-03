import { describe, it, expect } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { OPEN, sim, sureHits } from './kit';

describe('final review fixes (meta loop run)', () => {
  it('quick swap never makes an empty hand a free +50% (pistol ↔ empty)', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    g.s.hero.suit = ['quickswap'];
    g.s.hero.gear.hands = [makeWeapon('pistol', 1), null];
    g.s.hero.gear.active = 0;
    const t = g.s.time;
    g.act({ kind: 'swap' });
    g.act({ kind: 'swap' });
    expect(g.s.time - t).toBeCloseTo(1);
    expect(g.s.hero.fx.nextMult).toBe(1);
  });

  it('quick swap pays out once per attack: the swap back is a normal half turn with no bonus', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    sureHits(g);
    g.s.hero.suit = ['quickswap'];
    g.s.hero.gear.hands = [makeWeapon('pistol', 1), makeWeapon('sword', 1)];
    g.s.hero.gear.active = 0;
    g.s.foes[0]!.hp = 99;
    g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    const t = g.s.time;
    g.act({ kind: 'swap' });
    expect(g.s.time).toBe(t);
    expect(g.s.hero.fx.nextMult).toBeCloseTo(1.5);
    g.act({ kind: 'swap' });
    expect(g.s.time - t).toBeCloseTo(0.5);
  });

  it('a queued offer drops cards the first pick already put on the suit (and vanishes if none are left)', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.offers = [['dash', 'leap', 'finisher'], ['dash', 'counter', 'riposte'], ['dash']];
    g.act({ kind: 'choose', i: 0 });
    expect(g.s.offers[0]).toEqual(['counter', 'riposte']);
    g.act({ kind: 'choose', i: 0 });
    expect(g.s.offers).toHaveLength(0);
  });

  it('the recharge scroll also refills the suit charge', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.hero.charge = 1;
    (g.s.hero.gear.scrolls as Record<string, number>).recharge = 1;
    g.act({ kind: 'read', sc: 'recharge' });
    expect(g.s.hero.charge).toBe(g.s.hero.maxCharge);
  });
});
