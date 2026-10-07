import type { MemoryId } from '../party/memories';
import type { BaseClass } from '../party/partyDefs';
import type { TraitId } from '../party/traitDefs';
export type HeroSoulId = 'aren' | 'seraphine' | 'kael' | 'mira' | 'dorn';
export type CarriedSoul = BaseClass | { cls: BaseClass; hero?: HeroSoulId; memory?: MemoryId };
export const HERO_SOULS: Record<HeroSoulId, { name: string; cls: BaseClass; level: number; traits: Partial<Record<TraitId, number>> }> = {
  aren: { name: '아렌', cls: 'warrior', level: 4, traits: { tough: 1, shieldPro: 1 } },
  seraphine: { name: '세라핀', cls: 'cleric', level: 4, traits: { blessing: 2 } },
  kael: { name: '카엘', cls: 'archer', level: 4, traits: { rapid: 1, eagle: 1 } },
  mira: { name: '미라', cls: 'mage', level: 4, traits: { amplify: 1, resonance: 1 } },
  dorn: { name: '도른', cls: 'rogue', level: 4, traits: { vital: 1, sprint: 1 } },
};
