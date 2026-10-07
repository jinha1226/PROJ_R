import { COMMON_CARDS, KEYSTONE_CARDS } from './cardsCommon';
import { MELEE_CARDS } from './cardsMelee';
import { RANGED_CARDS } from './cardsRanged';
import { SUPPORT_CARDS } from './cardsSupport';
import type { TraitDef } from './traitTypes';
export { rank, type Mods, type Tag, type TraitDef } from './traitTypes';
export type TraitId = string;
export const MAX_RANK=3, PROMOTE_LEVEL=8;
/** every card: common, the five classes, cleric support and duos, oaths */
export const TRAITS: Record<string,TraitDef> = Object.fromEntries([...COMMON_CARDS,...MELEE_CARDS,...RANGED_CARDS,...SUPPORT_CARDS,...KEYSTONE_CARDS].map(d=>[d.id,d]));
