import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { useItem } from '../../src/sim/delve/gear';
import { alive, entOf } from '../../src/sim/party/partyCore';
import { implant, living } from '../../src/sim/roam/roam';
import { command } from '../../src/sim/party/partySim';
import type { ConsumableId } from '../../src/sim/delve/catalog';
function setup(consumable: ConsumableId) { const p = newDelve(2), u = living(p)[0]!; implant(p, u, 'mage', []); p.pack = []; p.pack.push({ id: 'use', consumable, ...(consumable === 'boltWand' ? { charges: 3 } : {}) }); const foes = p.units.filter(f => f.side === 'foe' && alive(p, f)).slice(0, 3); const at = { x: 10, y: 10 }; entOf(p, u.id)!.pos = { x: 9, y: 10 }; foes.forEach((f, i) => { entOf(p, f.id)!.pos = { x: 10 + i % 2, y: 10 + Math.floor(i / 2) }; f.asleep = false; }); return { p, u, foes, at }; }
it('fire bomb damages and burns every unit in its 3x3 and costs an action', () => { const { p, u, foes, at } = setup('fireBomb'); const ev = useItem(p, u.id, 'use', at); for (const f of foes)
    expect(f.status.burn).toBeDefined(); expect(ev.filter(e => e.type === 'hit').length).toBeGreaterThanOrEqual(3); expect(u.status.burn).toBeDefined(); expect(p.pack).toHaveLength(0); expect(u.nextAt).toBeGreaterThan(p.time); });
it('smoke hides allied clones for two seconds and halves enemy accuracy', () => { const { p, u, foes, at } = setup('smoke'); useItem(p, u.id, 'use', at); expect(u.hiddenUntil).toBe(2); for (const f of foes)
    expect(f.blindUntil).toBe(2); });
it('bolt wand loses one charge per use and disappears at zero', () => { const { p, u, foes } = setup('boltWand'); entOf(p, u.id)!.pos = { x: 9, y: 10 }; const at = entOf(p, foes[0]!.id)!.pos; for (let n = 2; n >= 0; n--) {
    expect(useItem(p, u.id, 'use', at).length).toBeGreaterThan(0);
    if (n)
        expect(p.pack[0]).toMatchObject({ charges: n });
    else
        expect(p.pack).toHaveLength(0);
} });
it('ice freezes, poison gives three stacks, rage boosts damage and cleanse clears the party', () => { for (const id of ['iceBomb', 'poisonJar', 'rage', 'cleanse'] as const) {
    const { p, u, foes, at } = setup(id);
    u.status.burn = { until: 3, by: u.id };
    useItem(p, u.id, 'use', at);
    if (id === 'iceBomb') {expect(foes[0]!.status.freeze).toBeDefined();expect(u.status.freeze).toBeDefined();}
    if (id === 'poisonJar') {expect(foes[0]!.status.poison?.stacks).toBe(3);expect(u.status.poison?.stacks).toBe(3);}
    if (id === 'rage') {
        expect(u.damageBuff).toBe(1.4);
        expect(u.damageBuffUntil).toBe(5);
    }
    if (id === 'cleanse')
        expect(u.status).toEqual({});
} });
it('potion heals forty percent; use command releases a manual turn', () => { const { p, u } = setup('potion'); const e = entOf(p, u.id)!; e.hp = 1; p.manual = u.id; p.waiting = true; expect(command(p, { kind: 'use', itemId: 'use' }).some(e => e.type === 'drink')).toBe(true); expect(e.hp).toBe(1 + Math.round(e.maxHp * .4)); expect(p.waiting).toBe(false); });
it('invalid and dead users leave the inventory and timing untouched', () => { const { p, u } = setup('fireBomb'); expect(useItem(p, u.id, 'use', { x: -1, y: -1 })).toEqual([]); expect(p.pack).toHaveLength(1); entOf(p, u.id)!.alive = false; expect(useItem(p, u.id, 'use', { x: 10, y: 10 })).toEqual([]); expect(p.pack).toHaveLength(1); });
it('companion AI drinks below thirty percent and uses a bomb only for a cluster of three', async () => {
    const { aiItem } = await import('../../src/sim/delve/gear');
    const { p, u, foes, at } = setup('fireBomb');
    entOf(p,u.id)!.pos={x:8,y:10};
    expect(aiItem(p, u).length).toBeGreaterThan(0);
    expect(p.pack).toHaveLength(0);
    p.pack.push({ id: 'heal', consumable: 'potion' });
    entOf(p, u.id)!.hp = 1;
    expect(aiItem(p, u).some(e => e.type === 'drink')).toBe(true);
    p.pack.push({ id: 'last', consumable: 'iceBomb' });
    for (const f of foes.slice(1))
        entOf(p, f.id)!.alive = false;
    entOf(p, u.id)!.hp = entOf(p, u.id)!.maxHp;
    entOf(p, foes[0]!.id)!.pos = at;
    expect(aiItem(p, u)).toEqual([]);
    expect(p.pack).toHaveLength(1);
});

it('AI keeps bombs when no cluster of three is clear of its allies',async()=>{const {aiItem}=await import('../../src/sim/delve/gear');const{p,u,at}=setup('fireBomb');entOf(p,u.id)!.pos=at;expect(aiItem(p,u)).toEqual([]);expect(p.pack).toHaveLength(1);});
it('a friendly thorns chain can kill the thrower and stops subsequent blast hits from that source',async()=>{
 const {print}=await import('../../src/sim/roam/roam');const{p,u,foes,at}=setup('fireBomb');const ally=print(p,'warrior',[])!;
 entOf(p,u.id)!.hp=1;entOf(p,ally.id)!.pos=at;ally.gear!.armor={id:'thorns',def:'thornPlate',power:0};
 p.units=[ally,...p.units.filter(x=>x!==ally)];const ev=useItem(p,u.id,'use',at);expect(entOf(p,u.id)!.alive).toBe(false);
 const death=ev.findIndex(e=>e.type==='die'&&e.dst===u.id);expect(ev.slice(death+1).some(e=>e.type==='hit'&&e.src===u.id)).toBe(false);
 for(const f of foes)expect(entOf(p,f.id)!.hp).toBe(entOf(p,f.id)!.maxHp);
 expect(p.pack.some(i=>i.id==='use')).toBe(false);
});
