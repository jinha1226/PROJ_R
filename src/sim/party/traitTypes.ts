import type { Unit } from './partyCore';
import type { BaseClass, AdvancedClass } from './partyDefs';
import type { TriggerDef } from './triggers';
import type { Tag } from './buildTypes';
export type { Tag } from './buildTypes';
export interface Mods {
  hp: number; move: number; hit: number; range: number; cover: number; regen: number; bond: number;
  crit: number; critDmg: number; cd: number; block: number; atk: number; amplify: number; heal: number;
  ward: number; whirlCd: number; whirlRange: number; counter: number; steadyMax: number; stealth: number;
  gritCd: number; poisonCap: number; react: number; taken: number; xp: number; bio: number; retreat: number;
}
/** law: a new rule · amp: grows with a tag · convert: turns one thing into another · duo: two classes together · oath: a keystone with a price */
export type CardKind = 'law' | 'amp' | 'convert' | 'duo' | 'oath';
export const KIND_NAME: Record<CardKind, string> = { law: '법칙', amp: '증폭', convert: '변환', duo: '듀오', oath: '서약' };
export interface TraitDef {
  id: string; name: string; tags: Tag[]; pool: 'common' | BaseClass | AdvancedClass | 'keystone' | 'duo'; ranks: 1 | 2 | 3;
  passive?: (u: Unit, rank: number) => Partial<Mods>; trigger?: (rank: number) => TriggerDef; triggers?: (rank: number) => TriggerDef[]; cost?: string;
  /** a card's kind, its line (Achra style) and, for a law, what its upgrade (rank 2) adds */
  kind?: CardKind; text?: string; up?: string;
  /** a duo card: the two classes it needs alive, and which of them runs its effect */
  duo?: [BaseClass, BaseClass]; who?: BaseClass | 'any';
}
export const rank = (u: { traits?: Partial<Record<string,number>> }, id: string): number => u.traits?.[id] ?? 0;
export function trait(id:string,name:string,tags:Tag[],pool:TraitDef['pool'],passive?:TraitDef['passive'],trigger?:TraitDef['trigger']): TraitDef {
  return { id,name,tags,pool,ranks:3,passive,trigger };
}

/** A card: one rule, its line, and (for a law) the upgrade a second pick adds. */
export function card(id: string, name: string, kind: CardKind, tags: Tag[], pool: TraitDef['pool'], text: string,
  fx: { passive?: TraitDef['passive']; trigger?: TraitDef['trigger']; triggers?: TraitDef['triggers'] }, up?: string): TraitDef {
  return { id, name, tags, pool, ranks: up ? 2 : 1, kind, text, up, ...fx };
}
