import type { Unit } from './partyCore';
import type { BaseClass, AdvancedClass } from './partyDefs';
import type { TriggerDef } from './triggers';
import type { Tag } from './buildTypes';
export type { Tag } from './buildTypes';
export interface Mods {
  hp: number; move: number; hit: number; range: number; cover: number; regen: number; bond: number;
  crit: number; critDmg: number; cd: number; block: number; atk: number; amplify: number; heal: number;
  ward: number; whirlCd: number; whirlRange: number; counter: number; steadyMax: number; stealth: number;
  gritCd: number; poisonCap: number; taken: number; xp: number; bio: number; retreat: number;
}
export interface TraitDef {
  id: string; name: string; tags: Tag[]; pool: 'common' | BaseClass | AdvancedClass | 'keystone'; ranks: 1 | 3;
  passive?: (u: Unit, rank: number) => Partial<Mods>; trigger?: (rank: number) => TriggerDef; cost?: string;
}
export const rank = (u: { traits?: Partial<Record<string,number>> }, id: string): number => u.traits?.[id] ?? 0;
export function trait(id:string,name:string,tags:Tag[],pool:TraitDef['pool'],passive?:TraitDef['passive'],trigger?:TraitDef['trigger']): TraitDef {
  return { id,name,tags,pool,ranks:3,passive,trigger };
}
