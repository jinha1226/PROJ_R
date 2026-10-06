import { COMMON } from './traitCommon';
import { CLASS_TRAITS } from './traitClasses';
import { ADVANCED_TRAITS, KEYSTONES } from './traitAdvanced';
import type { TraitDef } from './traitTypes';
export { rank, type Mods, type Tag, type TraitDef } from './traitTypes';
export type TraitId = string;
export const MAX_RANK=3, PROMOTE_LEVEL=8;
export const TRAITS: Record<string,TraitDef> = Object.fromEntries([...COMMON,...CLASS_TRAITS,...ADVANCED_TRAITS,...KEYSTONES].map(d=>[d.id,d]));
