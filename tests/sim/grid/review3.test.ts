import { describe, it, expect } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { runeStone, wouldErase } from '../../../src/sim/grid/engrave';
import { OPEN, sim, sureHits } from './kit';

const R = { x: 1, y: 0 };

describe('final review fixes (combos)', () => {
  it('a quick swap that also strikes is not free (no endless zero-time blows)', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.gear.hands = [makeWeapon('rifle', 1), Object.assign(makeWeapon('sword', 1), { engraves: [{ id: 'quickswap' as const, lvl: 1 as const }, { id: 'swapstrike' as const, lvl: 1 as const }] })];
    g.s.hero.gear.active = 0;
    g.s.foes[0]!.hp = 99;
    const t = g.s.time;
    g.act({ kind: 'swap' });
    expect(g.s.foes[0]!.hp).toBeLessThan(99);
    expect(g.s.time - t).toBeCloseTo(0.5);
  });

  it('a plain (tap-walk) step toward a foe two cells ahead walks instead of dashing', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]);
    g.s.hero.gear.hands[0] = Object.assign(makeWeapon('sword', 1), { engraves: [{ id: 'dash' as const, lvl: 1 as const }] });
    g.s.hero.gear.active = 0;
    g.s.foes[0]!.hp = 99;
    g.act({ kind: 'move', dir: R, plain: true });
    expect(g.s.foes[0]!.hp).toBe(99);
    expect(g.s.hero.pos).toEqual({ x: 6, y: 7 });
  });

  it('wouldErase names the engraving a new one pushes off a full weapon (none when it is already there)', () => {
    const w = Object.assign(makeWeapon('sword', 1), { engraves: [{ id: 'dash' as const, lvl: 1 as const }, { id: 'riposte' as const, lvl: 1 as const }] });
    expect(wouldErase(w, 'leap')).toBe('dash');
    expect(wouldErase(w, 'riposte')).toBeNull();
    expect(wouldErase(makeWeapon('axe', 1), 'leap')).toBeNull();
  });

  it('a rune for an engraving the weapon already has is refused (levels do nothing yet) and kept', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.hero.gear.hands[0] = Object.assign(makeWeapon('sword', 1), { engraves: [{ id: 'dash' as const, lvl: 1 as const }] });
    g.s.hero.gear.active = 0;
    g.s.hero.gear.bag = [runeStone('dash')];
    expect(g.act({ kind: 'inscribe', bag: 0 })[0]!.type).toBe('blocked');
    expect(g.s.hero.gear.bag).toHaveLength(1);
  });

  it('shove-shot does not shove when the other hand cannot fire (not enough charge after the melee refill)', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.gear.hands = [Object.assign(makeWeapon('sword', 1), { engraves: [{ id: 'shoveShot' as const, lvl: 1 as const }] }), makeWeapon('rifle', 1)];
    g.s.hero.gear.active = 0;
    g.s.hero.charge = 0;
    g.s.foes[0]!.hp = 99;
    const ev = g.act({ kind: 'move', dir: R });
    expect(ev.some((e) => e.type === 'push')).toBe(false);
  });

  it('a leap, dash or kite never lands on the stairs (no floor change mid-fight)', () => {
    const leap = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(leap);
    leap.s.map.stairs = { x: 5, y: 7 };
    leap.s.hero.gear.hands[0] = Object.assign(makeWeapon('axe', 1), { engraves: [{ id: 'leap' as const, lvl: 1 as const }] });
    leap.s.hero.gear.active = 0;
    leap.act({ kind: 'move', dir: R });
    expect(leap.s.run.floor).toBe(1);
    const dash = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]);
    dash.s.map.stairs = { x: 6, y: 7 };
    dash.s.hero.gear.hands[0] = Object.assign(makeWeapon('sword', 1), { engraves: [{ id: 'dash' as const, lvl: 1 as const }] });
    dash.s.hero.gear.active = 0;
    dash.s.foes[0]!.hp = 99;
    // a plain step onto the stairs is fine (going down on purpose); a dash there is not
    expect(dash.act({ kind: 'move', dir: R }).some((e) => e.type === 'engrave' && e.text === 'dash')).toBe(false);
    const kite = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(kite);
    kite.s.map.stairs = { x: 4, y: 7 };
    kite.s.hero.gear.hands[0] = Object.assign(makeWeapon('pistol', 1), { engraves: [{ id: 'kite' as const, lvl: 1 as const }] });
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
