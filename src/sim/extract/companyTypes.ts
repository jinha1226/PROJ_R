import type { Mercenary } from '../roster/types';
import type { Stack } from './inventory';
import type { Loadout } from './loadout';

/** The extraction company between sorties: mercenaries, their gear, the stash, and the next party. */
export interface XCompany {
  version: 2;
  seed: number;
  gold: number;
  stash: Stack[];
  /** supplies packed for the next sortie (potions, scrolls…) */
  pack: Stack[];
  pouch: Stack | null;
  /** living mercenaries; `injury` 1 = hurt (can deploy), 2+ = badly hurt (cannot) */
  mercs: Mercenary[];
  /** per-mercenary worn gear (bag/quick unused) */
  gear: Record<string, Loadout>;
  /** sortie order, leader first, at most 5 */
  party: string[];
  tavern: { merc: Mercenary; fee: number }[];
  fallen: { name: string; level: number; classId: string; sortie: number }[];
  sorties: number;
  extracted: number;
  bestHaul: number;
  nextId: number;
}

export type MemberEnd = { id: string; state: 'home' | 'carried' | 'dead'; xp: number; gear: Loadout };
export interface SortieEnd { outcome: 'extracted' | 'failed'; pack: Stack[]; pouch: Stack | null; members: MemberEnd[] }
