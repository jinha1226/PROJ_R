import { expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { drink, equip, PACK_SIZE, unequip } from '../../src/sim/delve/gear';
import { itemName, rollItem, type Item, type ItemDraft } from '../../src/sim/delve/items';
import { delveTick, newDelve } from '../../src/sim/delve/delveSim';
import { clones } from '../../src/sim/roam/roam';

const archer = () => { const p = newDelve(2); entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; delveTick(p, 0.1); return p; };
const give = (p: ReturnType<typeof newDelve>, it: ItemDraft) => { const full = { ...it, id: `t${p.pack.length}` } as Item; p.pack.push(full); return full.id; };

it('a clone that takes a soul gets its class\'s first weapon and armour; the party starts with two potions', () => {
  const p = archer();
  const u = clones(p)[0]!;
  expect(u.gear!.weapon.base).toBe('longbow');
  expect(u.gear!.armor!.base).toBe('cloth');
  expect(u.weapon).toBe('longbow');
  expect(p.potions).toBe(2);
});

it('names say rarity and affix', () => {
  expect(itemName({ id: 'a', kind: 'weapon', base: 'longbow', rarity: 'common' })).toBe('장궁');
  expect(itemName({ id: 'a', kind: 'weapon', base: 'longbow', rarity: 'fine' })).toBe('고급 장궁');
  expect(itemName({ id: 'a', kind: 'weapon', base: 'longbow', rarity: 'rare', affix: 'keen' })).toBe('날카로운 장궁');
});

it('deeper floors roll more rares', () => {
  const r = createRng(7);
  const rares = (floor: number) => Array.from({ length: 400 }, () => rollItem(r, floor)).filter((i) => i.kind !== 'trinket' && i.rarity === 'rare').length;
  expect(rares(10)).toBeGreaterThan(rares(1));
});

it('another line\'s weapon is refused; a fitting one swaps with the old into the pack', () => {
  const p = archer();
  expect(equip(p, 'hero', give(p, { kind: 'weapon', base: 'greataxe', rarity: 'common' }))).toBe(false);
  expect(equip(p, 'hero', give(p, { kind: 'weapon', base: 'crossbow', rarity: 'fine' }))).toBe(true);
  expect(unitOf(p, 'hero')!.weapon).toBe('crossbow');
  expect(p.pack.some((i) => i.kind === 'weapon' && i.base === 'longbow')).toBe(true);
});

it('plate takes a quarter off a blow', () => {
  const p = archer();
  equip(p, 'hero', give(p, { kind: 'armor', base: 'plate', rarity: 'common' }));
  const e = entOf(p, 'hero')!, hp = e.hp;
  damage(p, p.time, 'x', unitOf(p, 'hero')!, 8, []);
  expect(hp - e.hp).toBe(6);
});

it('the bulwark trinket raises max hp; taking it off clamps hp; a full pack refuses the unequip', () => {
  const p = archer();
  const e = entOf(p, 'hero')!;
  equip(p, 'hero', give(p, { kind: 'trinket', base: 'bulwark' }), 0);
  expect(e.maxHp).toBe(60);
  e.hp = 58;
  expect(unequip(p, 'hero', 0)).toBe(true);
  expect(e.maxHp).toBe(40);
  expect(e.hp).toBe(40);
  equip(p, 'hero', p.pack.find((i) => i.kind === 'trinket')!.id, 0);
  while (p.pack.length < PACK_SIZE) give(p, { kind: 'trinket', base: 'swift' });
  expect(unequip(p, 'hero', 0)).toBe(false);
});

it('a potion heals 40% and is used up', () => {
  const p = archer();
  const e = entOf(p, 'hero')!; e.hp = 10;
  drink(p, 'hero');
  expect(e.hp).toBe(26);
  expect(p.potions).toBe(1);
  p.potions = 0;
  expect(drink(p, 'hero')).toEqual([]);
});

it('full-pack swaps work, duplicate trinkets are refused, and low HP survives removal', () => {
  const p = archer(), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  equip(p, u.id, give(p, { kind: 'trinket', base: 'bulwark' }));
  expect(equip(p, u.id, give(p, { kind: 'trinket', base: 'bulwark' }), 1)).toBe(false);
  const weapon = give(p, { kind: 'weapon', base: 'crossbow', rarity: 'rare', affix: 'sturdy' });
  while (p.pack.length < PACK_SIZE) give(p, { kind: 'trinket', base: 'swift' });
  expect(equip(p, u.id, weapon)).toBe(true);
  expect(p.pack).toHaveLength(PACK_SIZE);
  p.pack.pop(); e.hp = 1;
  expect(unequip(p, u.id, 0)).toBe(true);
  expect(e.hp).toBe(1);
});

it('loot streams are reproducible and minimum rarities are honored', () => {
  const a = createRng(13), b = createRng(13);
  for (let n = 0; n < 50; n++) {
    const it = rollItem(a, 5, 'weapon', 'rare');
    expect(it).toEqual(rollItem(b, 5, 'weapon', 'rare'));
    expect(it.kind !== 'trinket' && it.rarity).toBe('rare');
    expect(it.kind !== 'trinket' && it.affix).toBeDefined();
  }
});
