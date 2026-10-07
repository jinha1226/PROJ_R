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
  id: string; name: string; tags: Tag[]; pool: 'common' | BaseClass | AdvancedClass | 'keystone' | 'duo' | 'shell'; ranks: 1 | 2 | 3;
  passive?: (u: Unit, rank: number) => Partial<Mods>; trigger?: (rank: number) => TriggerDef; triggers?: (rank: number) => TriggerDef[]; cost?: string;
  /** a card's kind, its line (Achra style) and, for a law, what its upgrade (rank 2) adds */
  kind?: CardKind; text?: string; up?: string;
  /** a signature or law card's rank 3: the special effect that changes its rule (spec §2.2.1) */
  up3?: string;
  /** a duo card: the two classes it needs alive, and which of them runs its effect */
  duo?: [BaseClass, BaseClass]; who?: BaseClass | 'any';
  /** the class branch the card belongs to (`line:branch`) and whether it is that branch's signature */
  branch?: string; sig?: boolean;
}
/** Puts a card in a branch (optionally as its signature). */
export const inBranch = (d: TraitDef, branch: string, sig = false): TraitDef => ({ ...d, branch, ...(sig ? { sig: true } : {}) });
export const rank = (u: { traits?: Partial<Record<string,number>> }, id: string): number => u.traits?.[id] ?? 0;
export function trait(id:string,name:string,tags:Tag[],pool:TraitDef['pool'],passive?:TraitDef['passive'],trigger?:TraitDef['trigger']): TraitDef {
  return { id,name,tags,pool,ranks:3,passive,trigger };
}

/** A card: one rule, its line, the upgrade a second pick adds and (signature and law cards) the special effect of a third. */
export function card(id: string, name: string, kind: CardKind, tags: Tag[], pool: TraitDef['pool'], text: string,
  fx: { passive?: TraitDef['passive']; trigger?: TraitDef['trigger']; triggers?: TraitDef['triggers'] }, up?: string, up3?: string): TraitDef {
  return { id, name, tags, pool, ranks: up3 ? 3 : up ? 2 : 1, kind, text, up, ...(up3 ? { up3 } : {}), ...fx };
}
/** An amp card's per-tag base: rank 2 adds 0.04 (a damage-taken amp below 1 takes 0.04 off instead). */
export const ampBase = (u: { traits?: Partial<Record<string, number>> }, id: string, base: number): number =>
  rank(u, id) >= 2 ? base + (base < 1 ? -0.04 : 0.04) : base;
