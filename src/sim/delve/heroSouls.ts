import type { MemoryId } from '../party/memories';
import type { BaseClass } from '../party/partyDefs';
import type { TraitId } from '../party/traitDefs';
export type HeroSoulId = 'aren' | 'seraphine' | 'kael' | 'mira' | 'dorn';
/** a soul stone held: its class, the hero it was, its memory; `unknown` while it has not reached the base (unidentified) */
export type CarriedSoul = BaseClass | { cls: BaseClass; hero?: HeroSoulId; memory?: MemoryId; unknown?: true };
/** A stone reaching the base is identified. */
export const identify = (c: CarriedSoul): CarriedSoul => (typeof c === 'string' || !c.unknown ? c : { cls: c.cls, hero: c.hero, memory: c.memory });
export const HERO_SOULS: Record<HeroSoulId, { name: string; cls: BaseClass; level: number; traits: Partial<Record<TraitId, number>> }> = {
  aren: { name: '아렌', cls: 'warrior', level: 4, traits: { warShout: 1, rage: 1, ironCounter: 1 } },
  seraphine: { name: '세라핀', cls: 'cleric', level: 4, traits: { answeredPrayer: 1, overflowGrace: 1, morale: 1 } },
  kael: { name: '카엘', cls: 'archer', level: 4, traits: { huntMark: 1, rapidFire: 1, focusFire: 1 } },
  mira: { name: '미라', cls: 'mage', level: 4, traits: { meteor: 1, fireball: 1, fireAmp: 1 } },
  dorn: { name: '도른', cls: 'rogue', level: 4, traits: { shadowStep: 1, vitals: 1, ambushArt: 1 } },
};
