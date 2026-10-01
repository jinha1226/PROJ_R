import type { Mercenary } from '../roster/types';
import type { Stack } from './inventory';
import type { Loadout } from './loadout';

/** The base between sorties: the hero, the safe stash, and what they will take out next. */
export interface XProfile {
  version: 1;
  seed: number;
  hero: Mercenary;
  gold: number;
  stash: Stack[];
  loadout: Loadout;
  sorties: number;
  extracted: number;
  bestHaul: number;
}
