import { ENGRAVE_IDS, ENGRAVES, type EngraveId } from './engraveCore';
import type { FoeKind, GridState } from './types';

import type { Family } from './engraveDefs';
export type { Family } from './engraveDefs';
export const FAMILY: Record<FoeKind, Family> = {
  minion: 'melee', brute: 'melee', archer: 'ranged', mage: 'element', ghoul: 'fusion', champion: 'fusion',
};
export const ELITE_MULT = 1.6;

/** Three fitting choices, reserving the first for a locked base engraving when available. */
export function absorbOffer(s: GridState, family: Family): EngraveId[] {
  const pool = ENGRAVE_IDS.filter(id => ENGRAVES[id].family === family && !s.hero.suit.includes(id));
  const locked = s.rng.shuffle(pool.filter(id => ENGRAVES[id].base && s.run.unlocked !== undefined && !s.run.unlocked.includes(id)));
  const first = locked[0];
  const rest = s.rng.shuffle(pool.filter(id => id !== first));
  return first ? [first, ...rest.slice(0, 2)] : rest.slice(0, 3);
}

/** Remember an engraving the first time a choice puts it on the suit this run. */
export function record(s: GridState, t: number, id: EngraveId): void {
  if (s.records.includes(id)) return;
  s.records.push(id);
  s.events.push({ t, type: 'record', src: s.hero.id, text: id });
}
