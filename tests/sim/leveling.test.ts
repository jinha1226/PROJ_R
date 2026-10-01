import { describe, it, expect } from 'vitest';
import { newRoster } from '../../src/sim/roster/generate';
import { addXp, xpToNext } from '../../src/sim/roster/leveling';
import { applyOfferToRoster, levelOffers, applyOffer } from '../../src/sim/roster/offers';
import { CLASSES } from '../../src/data/classes';
import type { Mercenary } from '../../src/sim/roster/types';

const roster = () => newRoster(21, 4);
const recruit = (): Mercenary => roster().mercs[1]!;

describe('leveling', () => {
  it('follows the xp curve and stacks pending level-ups', () => {
    expect([1, 2, 5].map(xpToNext)).toEqual([40, 70, 160]);
    const m = addXp(recruit(), 40 + 70 + 5);
    expect(m.level).toBe(3);
    expect(m.xp).toBe(5);
    expect(m.pendingLevelUps).toBe(2);
  });
  it('stops at level 10', () => {
    const m = addXp({ ...recruit(), level: 9 }, 100000);
    expect(m.level).toBe(10);
    expect(m.xp).toBe(0);
  });
  it('offers up to 3 deterministic choices; no upgrades before rank skilled', () => {
    const m = { ...recruit(), level: 2 };
    const a = levelOffers(m, roster(), 1);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(a).toEqual(levelOffers(m, roster(), 1));
    expect(a.some((o) => o.kind === 'upgrade')).toBe(false);
    const skilled = levelOffers({ ...m, level: 4, passives: ['toughness', 'ironSkin'], actives: CLASSES[m.classId].pool.slice(0, 2) }, roster(), 1);
    expect(skilled.some((o) => o.kind === 'upgrade')).toBe(true);
  });
  it('the novice is offered a promotion at level 3, which swaps kit and weapon', () => {
    let r = roster();
    const p = { ...r.mercs[0]!, level: 3, pendingLevelUps: 1 };
    r = { ...r, mercs: [p, ...r.mercs.slice(1)] };
    const offers = levelOffers(p, r, 3);
    expect(offers).toHaveLength(3);
    expect(offers.every((o) => o.kind === 'promote')).toBe(true);
    const r2 = applyOfferToRoster(r, p.id, { kind: 'promote', classId: 'mage' });
    const m = r2.mercs[0]!;
    expect(m.classId).toBe('mage');
    expect(m.actives).toEqual(CLASSES.mage.actives);
    expect(m.gear.weapon).toBe('worn_staff');
    expect(r2.inventory).toContain('worn_sword');
    expect(m.pendingLevelUps).toBe(0);
    expect(m.chronicle.at(-1)?.key).toBe('promoted');
  });
  it('learning a third active requires choosing a slot to replace', () => {
    const m = recruit();
    const fresh = CLASSES[m.classId].pool.find((s) => !m.actives.includes(s))!;
    expect(() => applyOffer(m, { kind: 'newActive', skillId: fresh })).toThrow();
    const m2 = applyOffer(m, { kind: 'newActive', skillId: fresh }, 1);
    expect(m2.actives[1]).toBe(fresh);
    expect(m2.actives[0]).toBe(m.actives[0]);
  });
  it('upgrades raise skill level and passives fill slots', () => {
    const m = recruit();
    const up = applyOffer(applyOffer(m, { kind: 'upgrade', skillId: m.actives[0]! }), { kind: 'upgrade', skillId: m.actives[0]! });
    expect(up.skillLevels[m.actives[0]!]).toBe(3);
    expect(applyOffer(m, { kind: 'passive', passiveId: 'toughness' }).passives).toEqual(['toughness']);
  });
  it('returns nothing when everything is learned and maxed', () => {
    const m = recruit();
    const c = CLASSES[m.classId];
    const maxed = { ...m, level: 10, actives: c.pool.slice(0, 2), passives: ['toughness', 'ironSkin'], tactics: ['weakHunt' as const, 'guardBack' as const],
      skillLevels: Object.fromEntries([...c.pool, c.ultimate].map((s) => [s, 3])) };
    const r = { ...roster(), tacticsOwned: [] };
    const offers = levelOffers(maxed, r, 9).filter((o) => o.kind !== 'newActive');
    expect(offers).toEqual([]);
  });
});
