import { expect, it } from 'vitest';
import { equip, drink, unequip, PACK_SIZE } from '../../src/sim/delve/gear';
import { itemName } from '../../src/sim/delve/items';
import { newDelve } from '../../src/sim/delve/delveSim';
import { implant, living } from '../../src/sim/roam/roam';
import { entOf } from '../../src/sim/party/partyCore';
const setup = () => { const p = newDelve(2), u = living(p)[0]!; implant(p, u, 'archer', []); return { p, u }; };
it('starter gear uses a proficient weapon, light armour and one empty accessory slot', () => { const { p, u } = setup(); expect(u.gear!.weapon?.def).toBe('longbow'); expect(u.gear!.armor?.def).toBe('cloth'); expect(u.gear!.accessory).toBeNull(); expect(p.pack.filter(i => 'consumable' in i && i.consumable === 'potion')).toHaveLength(2); });
it('fixed names replace rarity and affixes', () => { expect(itemName({ id: 'x', def: 'iceBow', power: 0 })).toBe('얼음 박힌 장궁'); expect(itemName({ id: 'x', consumable: 'iceBomb' })).toBe('빙결 폭탄'); });
it('a full pack can swap an accessory and empty slots return their exact item IDs', () => { const { p, u } = setup(); u.gear!.accessory = { id: 'worn', def: 'windRing', power: 0 }; p.pack.push({ id: 'swap', def: 'markRing', power: 0 }); while (p.pack.length < PACK_SIZE)
    p.pack.push({ id: String(p.pack.length), def: 'windRing', power: 0 }); expect(equip(p, u.id, 'swap')).toBe(true); expect(p.pack).toHaveLength(PACK_SIZE); expect(p.pack.some(i => i.id === 'worn')).toBe(true); expect(unequip(p, u.id, 'accessory')).toBe(false); p.pack.pop(); entOf(p, u.id)!.hp = 1; expect(unequip(p, u.id, 'accessory')).toBe(true); expect(p.pack.some(i => i.id === 'swap')).toBe(true); expect(entOf(p, u.id)!.hp).toBe(1); });
it('existing starter potions still heal forty percent and are consumed', () => { const { p, u } = setup(); const e = entOf(p, u.id)!; e.hp = 10; drink(p, u.id); expect(e.hp).toBe(26); expect(p.pack.filter(i => 'consumable' in i && i.consumable === 'potion')).toHaveLength(1); p.pack = []; expect(drink(p, u.id)).toEqual([]); });
