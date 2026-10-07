import { cardsOf } from './support/cardScene';
import { expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { CATALOG } from '../../src/sim/delve/catalog';
import { equip, G, sacrifice, unequip, weaponStats } from '../../src/sim/delve/gear';
import { rollItem } from '../../src/sim/delve/items';
import { newDelve } from '../../src/sim/delve/delveSim';
import { implant, living } from '../../src/sim/roam/roam';
import { takeParty, placeParty } from '../../src/sim/roam/carry';
import { sourcesOf } from '../../src/sim/party/triggers';
import { refitHp } from '../../src/sim/party/partyLevel';
import { promotionOptions, promote } from '../../src/sim/party/classKit';
export const setup = () => { const p = newDelve(2), u = living(p)[0]!; implant(p, u, 'warrior', []); return { p, u }; };
export const give = (p: ReturnType<typeof newDelve>, def: string) => { const id = `test-${p.nextItem++}`; p.pack.push({ id, def, power: 0 }); return id; };
it('has 18 weapons, 8 armours, 10 accessories and eight families; every item has tags and triggers', () => {
    const defs = Object.values(CATALOG);
    expect(['weapon', 'armor', 'accessory'].map(s => defs.filter(d => d.slot === s).length)).toEqual([18, 8, 10]);
    expect(new Set(defs.flatMap(d => d.family ? [d.family] : [])).size).toBe(8);
    for (const d of defs) {
        expect(d.tags.length).toBeGreaterThan(0);
        expect(d.triggers.length).toBeGreaterThanOrEqual(1);
    }
});
it('any clone equips any weapon; off proficiency changes damage and attack time exactly and disables innates', () => {
    const { p, u } = setup();
    equip(p, u.id, give(p, 'longbow'));
    expect(G.dmg(u)).toBe(.7);
    expect(G.atk(u)).toBe(1.2);
    expect(sourcesOf(p, u).some(d => d.id === '회오리 베기')).toBe(false);
    equip(p, u.id, give(p, 'swordShield'));
    expect(G.dmg(u)).toBe(1);
    expect(sourcesOf(p, u).some(d => d.id === '회오리 베기')).toBe(true);
});
it('weight above six adds five percent per point to movement and attack time', () => {
    const { p, u } = setup();
    equip(p, u.id, give(p, 'bloodGreat'));
    equip(p, u.id, give(p, 'ironPlate'));
    const weight = CATALOG.bloodGreat!.weight + CATALOG.ironPlate!.weight;
    expect(G.move(u)).toBeCloseTo(1 + .05 * (weight - 6));
    expect(G.atk(u)).toBeCloseTo(G.move(u));
});
it('sacrifice removes the donor and adds exactly 25% of its numbers, power numbers including previous donations', () => {
    const { p, u } = setup();
    equip(p, u.id, give(p, 'swordShield'));
    const before = weaponStats(u), donor = CATALOG.bloodGreat!;
    expect(sacrifice(p, u.id, give(p, 'bloodGreat')).length).toBeGreaterThan(0);
    const after = weaponStats(u);
    expect(after.dmg[0] - before.dmg[0]).toBeCloseTo(donor.dmg![0] * .25);
    expect(after.atk).toBe(before.atk);
    expect(p.pack.some(i => 'def' in i && i.def === 'bloodGreat')).toBe(false);
    const wrong = give(p, 'windRing');
    expect(sacrifice(p, u.id, wrong)).toEqual([]);
    expect(p.pack.some(i => i.id === wrong)).toBe(true);
    unequip(p, u.id, 'weapon');
    const empty = give(p, 'longbow');
    expect(sacrifice(p, u.id, empty)).toEqual([]);
});
it('worn tags and shield requirements are recounted on equip and unequip', () => {
    const { p, u } = setup();
    u.level = 8;
    u.traits = cardsOf('방패', 3);
    equip(p, u.id, give(p, 'swordShield'));
    expect(promotionOptions(p, u).find(o => o.to === 'guardian')?.met).toBe(true);
    unequip(p, u.id, 'weapon');
    expect(promotionOptions(p, u).find(o => o.to === 'guardian')?.met).toBe(false);
});
it('power, cooldowns, traits, consumables and promotion survive a shaft round trip independently', () => {
    const { p, u } = setup();
    sacrifice(p, u.id, give(p, 'bloodGreat'));
    u.level=8;u.traits=cardsOf('방패',3);promote(p,u.id,'guardian');
    u.ultReady = 42;u.trig['방벽']=17;
    u.traits = { vital: 2 };refitHp(p,u);
    p.pack.push({ id: 'wand', consumable: 'boltWand', charges: 2 });
    const c = takeParty(p), q = newDelve(4);
    placeParty(q, c);
    const v = living(q)[0]!;
    expect(v.gear).toEqual(u.gear);
    expect(v.ultReady).toBe(42);expect(v.cls).toBe('guardian');expect(v.soul).toBe('warrior');expect(v.trig['방벽']).toBe(17);
    expect(v.traits).toEqual(u.traits);
    expect(q.pack).toEqual(p.pack);
    v.gear!.weapon = null;
    expect(u.gear!.weapon).not.toBeNull();
});
it('loot is deterministic and restricted to the floor interval', () => {
    const a = createRng(7), b = createRng(7);
    for (let floor = 1; floor <= 5; floor++)
        for (let k = 0; k < 100; k++) {
            const d = rollItem(a, floor);
            expect(d).toEqual(rollItem(b, floor));
            if ('def' in d) {
                expect(CATALOG[d.def]!.floors[0]).toBeLessThanOrEqual(floor);
                expect(CATALOG[d.def]!.floors[1]).toBeGreaterThanOrEqual(floor);
            }
        }
});
it('donated power carries only beneficial numeric stats and itself can be donated without losing its gains', () => {
    const { p, u } = setup();
    const donor = give(p, 'crossbow');
    equip(p, u.id, donor);
    sacrifice(p, u.id, give(p, 'longbow'));
    const boosted = weaponStats(u);
    unequip(p, u.id, 'weapon');
    equip(p, u.id, give(p, 'swordShield'));
    const before = weaponStats(u);
    sacrifice(p, u.id, donor);
    const after = weaponStats(u);
    expect(after.dmg[0] - before.dmg[0]).toBeCloseTo(boosted.dmg[0] * .25);
    expect(after.dmg[1] - before.dmg[1]).toBeCloseTo(boosted.dmg[1] * .25);
    expect(after.range).toBe(before.range);
    expect(after.atk).toBe(before.atk);
});
it('tier-one chest coin branches are exactly consumable or gear without a second consumable roll',async()=>{
 const {roomStep}=await import('../../src/sim/delve/delveRooms');const {entOf}=await import('../../src/sim/party/partyCore');
 for(const consumable of [false,true]){const{p,u}=setup();p.pack=[];p.chests=[{pos:{...entOf(p,u.id)!.pos},tier:1,opened:false}];p.combat=false;
 p.s.rng.chance=chance=>chance===.5?consumable:chance===.25;
 roomStep(p,new Map(),[]);expect(p.pack).toHaveLength(1);expect('consumable'in p.pack[0]!).toBe(consumable);}
});
it('ordinary enemies can drop a shared-pack consumable',async()=>{
 const {roomStep}=await import('../../src/sim/delve/delveRooms');const {entOf}=await import('../../src/sim/party/partyCore');
 const{p}=setup();const f=p.units.find(u=>u.side==='foe')!;const e=entOf(p,f.id)!;e.alive=false;e.elite=false;
 p.chests=[];p.floorItems=[];p.s.rng.chance=chance=>chance===.1;roomStep(p,new Map(),[]);
 expect(p.floorItems).toHaveLength(1);expect('consumable'in p.floorItems[0]!.item).toBe(true);
});

it('three longbow donations preserve sword reach, duration and weight', () => {
    const { p, u } = setup(); const before = weaponStats(u), speed = G.atk(u), move = G.move(u);
    for (let n = 0; n < 3; n++) sacrifice(p, u.id, give(p, 'longbow'));
    expect(weaponStats(u).range).toBe(1); expect(weaponStats(u).atk).toBe(before.atk);
    expect(G.atk(u)).toBe(speed); expect(G.move(u)).toBe(move);
    expect(weaponStats(u).dmg[0]).toBeCloseTo(before.dmg[0] + 3 * CATALOG.longbow!.dmg![0] * .25);
});
