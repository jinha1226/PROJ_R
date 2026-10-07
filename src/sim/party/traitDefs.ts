import { COMMON_CARDS, KEYSTONE_CARDS } from './cardsCommon';
import { MELEE_CARDS } from './cardsMelee';
import { CLASS_TRAITS } from './traitClasses';
import { ADVANCED_TRAITS } from './traitAdvanced';
import type { TraitDef } from './traitTypes';
export { rank, type Mods, type Tag, type TraitDef } from './traitTypes';
export type TraitId = string;
export const MAX_RANK=3, PROMOTE_LEVEL=8;
export const TRAITS: Record<string,TraitDef> = Object.fromEntries([...COMMON_CARDS,...MELEE_CARDS,...CLASS_TRAITS.filter(d=>d.pool!=='warrior'&&d.pool!=='rogue'),...ADVANCED_TRAITS,...KEYSTONE_CARDS].map(d=>[d.id,d]));
