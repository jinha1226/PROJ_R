import { describe, it, expect } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { WEAPONS, makeWeapon, rollEquipment } from '../../../src/sim/grid/items';
import { activeWeapon, addToBag, BAG_SIZE, equipFromBag, startGear, swapHands, wearFromBag } from '../../../src/sim/grid/gear';
import { newState } from '../../../src/sim/grid/state';
import { handMap, OPEN } from './kit';

describe('starting guns', () => {
  it.each(['pistol', 'shotgun', 'rifle'] as const)('starts with %s and the same neutral stats', (gun) => {
    const g = startGear(gun);
    expect(g.hands.map((w) => w?.group ?? null)).toEqual([gun, 'dagger']);
    expect(g.hands[0]).not.toHaveProperty('engraves');
    expect(g.armor).toMatchObject({ kind: 'armor', name: '요원 슈트', reduce: 1 });
    expect(g.belt.potion).toBe(2);
    expect(newState(handMap(OPEN), 1, gun).hero.maxHp).toBe(35);
  });
});

describe('loot', () => {
  it('found equipment is about five sixths melee, and better on deeper floors', () => {
    const rng = createRng(5);
    const rolls = (floor: number) => Array.from({ length: 400 }, () => rollEquipment(rng, floor));
    const f1 = rolls(1);
    const weapons = f1.filter((e) => e.kind === 'weapon');
    const melee = weapons.filter((w) => w.kind === 'weapon' && WEAPONS[w.group].melee).length / weapons.length;
    expect(melee).toBeGreaterThan(0.77);
    expect(melee).toBeLessThan(0.9);
    const t2 = (list: ReturnType<typeof rolls>) => list.filter((e) => e.tier >= 2).length / list.length;
    expect(t2(rolls(3))).toBeGreaterThan(t2(f1));
  });
});

describe('hands and bag', () => {
  it('swapping hands switches the weapon in use', () => {
    const g = startGear('pistol');
    expect(activeWeapon(g)?.group).toBe('pistol');
    swapHands(g);
    expect(activeWeapon(g)?.group).toBe('dagger');
  });

  it('a weapon from the bag goes into the hand in use and the old one into the bag', () => {
    const g = startGear('pistol');
    addToBag(g, makeWeapon('axe', 1));
    expect(equipFromBag(g, 0)).toBe(true);
    expect(activeWeapon(g)?.group).toBe('axe');
    expect(g.bag.map((e) => e.kind === 'weapon' && e.group)).toEqual(['pistol']);
  });

  it('the agent never takes the suit off: armour from the bag is refused', () => {
    const g = startGear('pistol');
    addToBag(g, { kind: 'armor', tier: 2, name: '사슬 갑옷', reduce: 2 });
    expect(wearFromBag(g, 0)).toBe(false);
    expect(g.armor?.name).toBe('요원 슈트');
  });

  it('the bag holds eight things', () => {
    const g = startGear('pistol');
    for (let i = 0; i < BAG_SIZE; i++) expect(addToBag(g, makeWeapon('mace', 1))).toBe(true);
    expect(addToBag(g, makeWeapon('mace', 1))).toBe(false);
  });
});
