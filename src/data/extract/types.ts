import type { Stats, UniqueId, WeaponType } from '../types';

export type GearSlot = 'weapon' | 'head' | 'chest' | 'hands' | 'feet' | 'belt' | 'trinket' | 'bag';
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'head', 'chest', 'hands', 'feet', 'belt', 'trinket', 'bag'];
export type ItemKind = 'gear' | 'consumable' | 'part' | 'junk' | 'relic' | 'key';
export type Tier = 0 | 1 | 2 | 3 | 4;

export type ItemUse =
  | { kind: 'heal'; frac: number }
  | { kind: 'antidote'; sec: number }
  | { kind: 'smoke'; radius: number }
  | { kind: 'recall'; sec: number };

/** An item that can be found, carried, lost, and sold in extraction sorties. */
export interface XItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  tier: Tier;
  /** sell value in gold (the merchant sells at twice this) */
  value: number;
  weight: number;
  /** how many fit in one slot (1 = no stacking) */
  stack: 1 | 3 | 5;
  slot?: GearSlot;
  weaponType?: WeaponType;
  stats?: Partial<Stats>;
  unique?: UniqueId;
  visual?: { weapon?: string; offhand?: string; helmet?: boolean; cape?: boolean };
  belt?: { quickSlots: 1 | 2 | 3 | 4 };
  bag?: { slots: 6 | 10 | 14 | 18; carry: number };
  use?: ItemUse;
}
