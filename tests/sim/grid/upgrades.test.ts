import { describe, expect, it } from 'vitest';
import { evasionOf } from '../../../src/sim/grid/defense';
import { makeWeapon } from '../../../src/sim/grid/items';
import { nextFloor, settleKills } from '../../../src/sim/grid/run';
import { applyUpgrade, upgradeOffer, UPGRADES } from '../../../src/sim/grid/upgrades';
import { heroDmg } from '../../../src/sim/grid/weapons';
import { OPEN, sim, sureHits } from './kit';

describe('level-up suit upgrades', () => {
  it('starts with zero bonuses and no pending upgrades', () => {
    const { s } = sim(OPEN, { x: 5, y: 7 });
    expect(s.hero.bonus).toEqual({ killCharge: 0, evasion: 0, gunDmg: 0, meleeDmg: 0 });
    expect(s.upgrades).toEqual([]);
  });

  it('a level gained queues three different upgrades and no engravings', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.xp = 9;
    g.s.foes[0]!.hp = 1;
    g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.hero.level).toBe(2);
    expect(g.s.upgrades).toHaveLength(1);
    expect(g.s.upgrades[0]).toHaveLength(3);
    expect(new Set(g.s.upgrades[0]).size).toBe(3);
    expect(g.s.offers).toEqual([]);
  });

  it('offers are seed deterministic, varied, and contain only upgrade ids', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const a = sim(OPEN, { x: 5, y: 7 }, [], seed).s;
      const b = sim(OPEN, { x: 5, y: 7 }, [], seed).s;
      const offer = upgradeOffer(a);
      expect(offer).toEqual(upgradeOffer(b));
      expect(new Set(offer).size).toBe(3);
      for (const id of offer) { expect(UPGRADES).toHaveProperty(id); seen.add(id); }
    }
    expect(seen.size).toBe(6);
  });

  it('charge and hp increase both capacity and current values and stack', () => {
    const { s } = sim(OPEN, { x: 5, y: 7 });
    s.hero.charge = 3;
    s.hero.hp = 17;
    for (let n = 0; n < 2; n++) { applyUpgrade(s, 'charge'); applyUpgrade(s, 'hp'); }
    expect([s.hero.charge, s.hero.maxCharge]).toEqual([7, 14]);
    expect([s.hero.hp, s.hero.maxHp]).toEqual([27, 45]);
    s.hero.charge = s.hero.maxCharge;
    applyUpgrade(s, 'charge');
    expect(s.hero.charge).toBe(s.hero.maxCharge);
  });

  it('killCharge refills three per melee kill, in addition to the landed hit', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    g.s.hero.charge = 0;
    g.s.foes[0]!.hp = 1;
    applyUpgrade(g.s, 'killCharge');
    g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.hero.charge).toBe(4);
    applyUpgrade(g.s, 'killCharge');
    expect(g.s.hero.bonus.killCharge).toBe(2);
  });

  it('evasion adds three percentage points each time', () => {
    const { s } = sim(OPEN, { x: 5, y: 7 });
    const base = evasionOf(s);
    applyUpgrade(s, 'evasion');
    expect(evasionOf(s)).toBeCloseTo(base + 0.03);
    applyUpgrade(s, 'evasion');
    expect(evasionOf(s)).toBeCloseTo(base + 0.06);
  });

  it('gun and melee damage stack only on their matching weapon groups', () => {
    const { s } = sim(OPEN, { x: 5, y: 7 });
    const pistol = makeWeapon('pistol', 1), sword = makeWeapon('sword', 1), staff = makeWeapon('staff', 1);
    const gunBase = heroDmg(s, pistol), meleeBase = heroDmg(s, sword), staffBase = heroDmg(s, staff);
    applyUpgrade(s, 'meleeDmg');
    expect(heroDmg(s, sword)).toEqual(meleeBase.map((v) => v + 1));
    expect(heroDmg(s, pistol)).toEqual(gunBase);
    applyUpgrade(s, 'gunDmg');
    expect(heroDmg(s, pistol)).toEqual(gunBase.map((v) => v + 1));
    applyUpgrade(s, 'gunDmg');
    applyUpgrade(s, 'meleeDmg');
    expect(heroDmg(s, pistol)).toEqual(gunBase.map((v) => v + 2));
    expect(heroDmg(s, sword)).toEqual(meleeBase.map((v) => v + 2));
    expect(heroDmg(s, staff)).toEqual(staffBase);
  });

  it('chooses for free while frozen without ticking burn, and consumes only the first offer', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.upgrades = [['gunDmg', 'hp', 'charge'], ['evasion']];
    g.s.offers = [['dash']];
    g.s.hero.status = { burn: 3, freeze: 2, poison: 1 };
    g.s.time = g.s.hero.nextAt = 7;
    const hp = g.s.hero.hp;
    expect(g.act({ kind: 'upgrade', i: 0 })).toContainEqual({ t: 7, type: 'upgrade', src: 'hero', text: 'gunDmg' });
    expect([g.s.time, g.s.hero.nextAt, g.s.hero.hp]).toEqual([7, 7, hp]);
    expect(g.s.hero.status).toEqual({ burn: 3, freeze: 2, poison: 1 });
    expect(g.s.hero.bonus.gunDmg).toBe(1);
    expect(g.s.upgrades).toEqual([['evasion']]);
    expect(g.s.offers).toEqual([['dash']]);
  });

  it('skips for free; absent offers and invalid indices are blocked, even while frozen', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.hero.status = { burn: 3, freeze: 2, poison: 0 };
    g.s.upgrades = [['charge', 'hp', 'evasion']];
    for (const i of [-1, 3, 0.5]) {
      expect(g.act({ kind: 'upgrade', i })[0]!.type).toBe('blocked');
      expect(g.s.upgrades).toHaveLength(1);
    }
    expect(g.act({ kind: 'upgrade', i: null }).some((e) => e.type === 'upgrade')).toBe(false);
    expect(g.s.upgrades).toEqual([]);
    for (const i of [null, 0]) expect(g.act({ kind: 'upgrade', i })[0]!.type).toBe('blocked');
    expect(g.s.time).toBe(0);
    expect(g.s.hero.status).toEqual({ burn: 3, freeze: 2, poison: 0 });
    expect(g.s.hero.maxCharge).toBe(10);
  });

  it('queues each gained level and retains upgrades and bonuses across floors', () => {
    const { s } = sim(OPEN, { x: 5, y: 7 });
    s.hero.xp = 25;
    settleKills(s, new Set());
    expect(s.upgrades).toHaveLength(2);
    const pending = s.upgrades.map((offer) => [...offer]);
    applyUpgrade(s, 'gunDmg');
    nextFloor(s);
    expect(s.upgrades).toEqual(pending);
    expect(s.hero.bonus.gunDmg).toBe(1);
  });

  it('echo absorption still queues engravings independently of upgrades', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.upgrades = [['hp', 'charge', 'evasion']];
    g.s.floorItems.push({ pos: { x: 6, y: 7 }, item: { kind: 'echo', family: 'melee', name: '잔향' } });
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(ev.some((e) => e.type === 'absorb')).toBe(true);
    expect(g.s.offers).toHaveLength(1);
    expect(g.s.offers[0]).toHaveLength(3);
    expect(g.s.upgrades).toEqual([['hp', 'charge', 'evasion']]);
  });
});
