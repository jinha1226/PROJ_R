import type { MemoryId } from '../party/memories';
import type { BaseClass } from '../party/partyDefs';
import type { TraitId } from '../party/traitDefs';
export type HeroSoulId = 'aren' | 'seraphine' | 'kael' | 'mira' | 'dorn';
export type CarriedSoul = BaseClass | { cls: BaseClass; hero?: HeroSoulId; memory?: MemoryId };
export const HERO_SOULS: Record<HeroSoulId, { name: string; cls: BaseClass; level: number; traits: Partial<Record<TraitId, number>> }> = {
  aren: { name: '아렌', cls: 'warrior', level: 4, traits: { thorns: 1, steadfast: 1, unyielding: 1 } },
  seraphine: { name: '세라핀', cls: 'cleric', level: 4, traits: { answeredPrayer: 1, overflowGrace: 1, morale: 1 } },
  kael: { name: '카엘', cls: 'archer', level: 4, traits: { huntMark: 1, rapidFire: 1, focusFire: 1 } },
  mira: { name: '미라', cls: 'mage', level: 4, traits: { elemCycle: 1, combust: 1, reactAmp: 1 } },
  dorn: { name: '도른', cls: 'rogue', level: 4, traits: { vitals: 1, envenom: 1, shadowStep: 1 } },
};
