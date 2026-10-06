import type { Rng } from '../../core/rng';
import { CATALOG, CONSUMABLES, type ConsumableId, type Item, type ItemDef } from './catalog';
export type { Item, ConsumableId } from './catalog';
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
export type ItemDraft = WithoutId<Item>;
export const itemName = (it: Item): string => 'def' in it ? CATALOG[it.def]!.name : CONSUMABLES[it.consumable];
export function rollConsumable(rng: Rng): ItemDraft {
    const consumable = rng.pick(Object.keys(CONSUMABLES) as ConsumableId[]);
    return { consumable, ...(consumable === 'boltWand' ? { charges: 3 } : {}) };
}
export function rollItem(rng: Rng, floor: number, slot?: ItemDef['slot'], tier = 1): ItemDraft {
    if (!slot && tier === 1 && rng.chance(.25))
        return rollConsumable(rng);
    const pool = Object.values(CATALOG).filter(d => (!slot || d.slot === slot) && d.floors[0] <= floor && d.floors[1] >= floor);
    const deep = Math.max(...pool.map(d => d.floors[0]));
    const candidates = tier > 1 ? pool.filter(d => d.floors[0] >= Math.max(1, deep - (tier === 3 ? 0 : 1))) : pool;
    return { def: rng.pick(candidates).id, power: 0 };
}
