import { useItem } from './consumables';
import { alive, entOf, unitOf, type Unit } from '../party/partyCore';
import { CLASSES, WEAPONS, type ClassId, type WeaponId } from '../party/partyDefs';
import { FAMILY, kitOf } from '../party/classKit';
import { refitHp } from '../party/partyLevel';
import type { GEvent } from '../grid/types';
import type { RoamParty } from '../roam/roam';
import { CATALOG, type GearItem, type Item, type ItemDef, type Numbers } from './catalog';
export { useItem, aiItem } from './consumables';
export interface Loadout {
    weapon: GearItem | null;
    armor: GearItem | null;
    accessory: GearItem | null;
}
export const PACK_SIZE = 16;
export const nextItemId = (p: RoamParty): string => `item-${p.nextItem++}`;
export const worn = (u: Unit): GearItem[] => Object.values(u.gear ?? {}).filter((i): i is GearItem => !!i);
export const weaponDef = (u: Unit): ItemDef | undefined => u.gear?.weapon ? CATALOG[u.gear.weapon.def] : undefined;
export function proficient(u: Unit): boolean { const f = weaponDef(u)?.family ?? (u.weapon && FAMILY[u.weapon]); return !!u.cls && !!f && kitOf(u).proficient.includes(f); }
export function numbers(it: GearItem): Numbers {
    const d = CATALOG[it.def]!;
    const n: Numbers = { min: d.dmg?.[0] ?? 0, max: d.dmg?.[1] ?? 0, range: d.range ?? 0, atk: d.atk ?? 0, armor: d.armor ?? 0, block: d.block ?? 0, weight: d.weight };
    for (const k of ['min', 'max', 'armor', 'block'] as const)
        n[k] = n[k] * (1 + it.power) + (it.bonus?.[k] ?? 0);
    return n;
}
export function weaponStats(u: Unit): {
    dmg: [
        number,
        number
    ];
    range: number;
    atk: number;
} {
    if (!u.gear?.weapon)
        return WEAPONS[u.weapon ?? 'fists'];
    const n = numbers(u.gear.weapon);
    return { dmg: [n.min, n.max], range: n.range, atk: n.atk };
}
const weight = (u: Unit) => 1 + .05 * Math.max(0, worn(u).reduce((n, it) => n + numbers(it).weight, 0) - 6);
export const G = {
    dmg: (u: Unit): number => u.cls && u.weapon !== 'fists' && !proficient(u) ? .7 : u.cls === 'berserker' && (weaponDef(u)?.twoHand || (!u.gear && u.weapon === 'greataxe')) ? 1.2 : 1,
    atk: (u: Unit): number => weight(u) * (u.cls && u.weapon !== 'fists' && !proficient(u) ? 1.2 : 1),
    move: weight,
    reduce: (u: Unit): number => Math.min(.8, worn(u).reduce((n, it) => n + numbers(it).armor, 0)),
    block: (u: Unit): number => Math.min(.8, worn(u).reduce((n, it) => n + numbers(it).block, 0)),
    hp: (u: Unit): number => { void u; return 0; }, cd: (u: Unit): number => { void u; return 1; },
    healTaken: (u: Unit): number => u.traits?.bloodPact ? .7 : 1,
};
export function visualWeapon(d: ItemDef): WeaponId { return ({ sword: 'swordShield', great: 'greataxe', mace: 'mace', dagger: 'daggers', bow: 'longbow', crossbow: 'crossbow', staff: 'staff', relic: 'symbol' } as const)[d.family!]; }
export function starterGear(cls: ClassId, nextId: () => string): Loadout {
    if (cls === 'shell')
        return { weapon: null, armor: null, accessory: null };
    const base = CLASSES[cls].weapons[0]!, def = base === 'greataxe' ? 'greataxe' : base;
    return { weapon: { id: nextId(), def, power: 0 }, armor: { id: nextId(), def: ['warrior', 'cleric', 'guardian', 'inquisitor'].includes(cls) ? 'leather' : 'cloth', power: 0 }, accessory: null };
}
export const canEquip = (u: Unit, it: Item): boolean => u.side === 'hero' && !!u.cls && 'def' in it && !!CATALOG[it.def];
function refitGear(p: RoamParty, u: Unit): void { const e = entOf(p, u.id)!, hp = e.hp; refitHp(p, u); e.hp = Math.max(1, Math.min(hp, e.maxHp)); }
export function equip(p: RoamParty, heroId: string, itemId: string): boolean {
    const u = unitOf(p, heroId), i = p.pack.findIndex(it => it.id === itemId), it = p.pack[i];
    if (!u || !alive(p, u) || !u.gear || !it || !canEquip(u, it) || !('def' in it))
        return false;
    const d = CATALOG[it.def]!, old = u.gear[d.slot];
    u.gear[d.slot] = it;
    if (d.slot === 'weapon')
        u.weapon = visualWeapon(d);
    p.pack.splice(i, 1);
    if (old)
        p.pack.push(old);
    refitGear(p, u);
    return true;
}
export function unequip(p: RoamParty, heroId: string, slot: ItemDef['slot']): boolean {
    const u = unitOf(p, heroId);
    if (!u?.gear || !alive(p, u) || p.pack.length >= PACK_SIZE)
        return false;
    const it = u.gear[slot];
    if (!it)
        return false;
    p.pack.push(it);
    u.gear[slot] = null;
    if (slot === 'weapon')
        u.weapon = 'fists';
    refitGear(p, u);
    return true;
}
/** Surface forges improve sacrifice; underground gear keeps the ordinary rate. */
export function sacrificeRate(p: RoamParty): number {
    return 'buildings' in p && (p.buildings as { kind: string }[]).some(b => b.kind === 'forge') ? .35 : .25;
}
export function sacrifice(p: RoamParty, heroId: string, itemId: string): GEvent[] {
    const u = unitOf(p, heroId), i = p.pack.findIndex(it => it.id === itemId), it = p.pack[i];
    if (!u?.gear || !alive(p, u) || !it || !('def' in it))
        return [];
    const slot = CATALOG[it.def]?.slot, to = slot && u.gear[slot];
    if (!to)
        return [];
    const rate = sacrificeRate(p);
    const n = numbers(it), base = numbers({ ...to, power: 0, bonus: undefined }), gain = (1 + it.power) * rate;
    to.bonus ??= {};
    for (const k of ['min', 'max', 'armor', 'block'] as const)
        to.bonus[k] = (to.bonus[k] ?? 0) + n[k] * rate - base[k] * gain;
    to.power += gain;
    p.pack.splice(i, 1);
    refitGear(p, u);
    return [{ t: p.time, type: 'buff', src: heroId, text: '희생' }];
}
export function drink(p: RoamParty, heroId: string): GEvent[] {
    const it = p.pack.find(it => 'consumable' in it && it.consumable === 'potion');
    return it ? useItem(p, heroId, it.id) : [];
}
