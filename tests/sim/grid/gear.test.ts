import { describe, it, expect } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { WEAPONS, makeWeapon, rollEquipment } from '../../../src/sim/grid/items';
import { activeWeapon, addToBag, BAG_SIZE, CLASS_BONUS, equipFromBag, startGear, swapHands, wearFromBag } from '../../../src/sim/grid/gear';
import { newState } from '../../../src/sim/grid/state';
import { handMap, OPEN } from './kit';

describe('classes', () => {
  it('a warrior starts with a sword and a crossbow, leather, two potions and ten arrows, and more health', () => {
    const g = startGear('warrior');
    expect(g.hands.map((w) => w?.group)).toEqual(['sword', 'crossbow']);
    expect(g.armor?.reduce).toBe(1);
    expect(g.belt.potion).toBe(2);
    expect(g.arrows).toBe(10);
    const m = handMap(OPEN);
    m.start = { x: 3, y: 3 };
    expect(newState(m, 1, 'warrior').hero.maxHp).toBe(30 + CLASS_BONUS.warrior.maxHp);
  });

  it('a hunter starts with a bow and a dagger and plenty of arrows', () => {
    const g = startGear('hunter');
    expect(g.hands.map((w) => w?.group)).toEqual(['bow', 'dagger']);
    expect(g.arrows).toBe(20);
  });

  it('a mage starts with a fire staff holding an extra charge, a dagger, and two flasks', () => {
    const g = startGear('mage');
    expect(g.hands[0]).toMatchObject({ group: 'staff', element: 'fire', charges: 4 });
    expect(g.hands[1]?.group).toBe('dagger');
    expect(g.belt.fireFlask).toBe(1);
    expect(g.belt.frostFlask).toBe(1);
  });
});

describe('loot', () => {
  it('found equipment is about half melee, half ranged, and better on deeper floors', () => {
    const rng = createRng(5);
    const rolls = (floor: number) => Array.from({ length: 400 }, () => rollEquipment(rng, floor));
    const f1 = rolls(1);
    const weapons = f1.filter((e) => e.kind === 'weapon');
    const melee = weapons.filter((w) => w.kind === 'weapon' && WEAPONS[w.group].melee).length / weapons.length;
    expect(melee).toBeGreaterThan(0.4);
    expect(melee).toBeLessThan(0.6);
    const t2 = (list: ReturnType<typeof rolls>) => list.filter((e) => e.tier >= 2).length / list.length;
    expect(t2(rolls(3))).toBeGreaterThan(t2(f1));
  });
});

describe('hands and bag', () => {
  it('swapping hands switches the weapon in use', () => {
    const g = startGear('warrior');
    expect(activeWeapon(g)?.group).toBe('sword');
    swapHands(g);
    expect(activeWeapon(g)?.group).toBe('crossbow');
  });

  it('a weapon from the bag goes into the hand in use and the old one into the bag', () => {
    const g = startGear('warrior');
    addToBag(g, makeWeapon('axe', 1));
    expect(equipFromBag(g, 0)).toBe(true);
    expect(activeWeapon(g)?.group).toBe('axe');
    expect(g.bag.map((e) => e.kind === 'weapon' && e.group)).toEqual(['sword']);
  });

  it('armor from the bag is worn and the old armor goes back', () => {
    const g = startGear('warrior');
    addToBag(g, { kind: 'armor', tier: 2, name: '사슬 갑옷', reduce: 2 });
    expect(wearFromBag(g, 0)).toBe(true);
    expect(g.armor?.reduce).toBe(2);
    expect(g.bag[0]).toMatchObject({ kind: 'armor', reduce: 1 });
  });

  it('the bag holds eight things', () => {
    const g = startGear('hunter');
    for (let i = 0; i < BAG_SIZE; i++) expect(addToBag(g, makeWeapon('mace', 1))).toBe(true);
    expect(addToBag(g, makeWeapon('mace', 1))).toBe(false);
  });
});
