import { expect, it } from 'vitest';
import { rollOffer } from '../../src/sim/party/traitPool';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { scene } from './support/cardScene';

it('the first level-up offers two laws of the class and one more', () => {
  const { p, u } = scene('mage'); u.level = 2;
  for (let i = 0; i < 20; i++) {
    const o = rollOffer(p, u);
    expect(o).toHaveLength(3);
    expect(o.slice(0, 2).every((id) => TRAITS[id]!.kind === 'law' && TRAITS[id]!.pool === 'mage')).toBe(true);
  }
});

it('an owned law comes back as its upgrade; a card without one does not come back', () => {
  const { p, u } = scene('mage'); u.level = 3;
  u.traits = Object.fromEntries(Object.values(TRAITS).filter((d) => d.pool === 'mage').map((d) => [d.id, 1]));
  for (let i = 0; i < 20; i++) {
    const own = rollOffer(p, u).filter((id) => TRAITS[id]!.pool === 'mage');
    expect(own.every((id) => TRAITS[id]!.ranks === 2)).toBe(true);
  }
});

it('duos are offered only to a body holding the partner class; an exhausted pool still offers what is left', () => {
  const { p, u } = scene('warrior'); u.level = 5;
  const duoIds = Object.values(TRAITS).filter((d) => d.pool === 'duo').map((d) => d.id);
  for (let i = 0; i < 30; i++) expect(rollOffer(p, u).some((id) => duoIds.includes(id))).toBe(false);
  u.souls = [...u.souls!, { cls: 'archer', ultReady: 0 }];
  let seen = false; for (let i = 0; i < 80 && !seen; i++) seen = rollOffer(p, u).includes('bait');
  expect(seen).toBe(true);
  u.traits = Object.fromEntries(Object.values(TRAITS).filter((d) => d.pool !== 'keystone').map((d) => [d.id, d.ranks]));
  expect(rollOffer(p, u)).toEqual([]);
});

it('a level-up with nothing left to offer spends its pick instead of waiting forever', async () => {
  const { gainXp, LEVEL_XP } = await import('../../src/sim/party/partyLevel');
  const { p, u } = scene('warrior'); u.level = 4; u.xp = LEVEL_XP[3]!;
  u.traits = Object.fromEntries(Object.values(TRAITS).filter((d) => d.pool !== 'keystone').map((d) => [d.id, d.ranks]));
  gainXp(p, u, LEVEL_XP[4]! - u.xp, []);
  expect(u.level).toBe(5); expect(u.picks ?? 0).toBe(0); expect(u.offer ?? []).toEqual([]);
});
