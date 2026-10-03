import { ENGRAVE_IDS, ENGRAVES, type EngraveId } from './engraveCore';
import type { FoeKind, GridState } from './types';

export type Family = 'melee' | 'ranged' | 'magic' | 'any' | 'all';
export const FAMILY: Record<FoeKind, Family> = {
  minion: 'melee', brute: 'melee', archer: 'ranged', mage: 'magic', ghoul: 'any', champion: 'all',
};
export const ELITE_MULT = 1.6;

/** Up to two records and one discovery from the family, filling shortages from the other pool. */
export function absorbOffer(s: GridState, family: Family): EngraveId[] {
  const pool = ENGRAVE_IDS.filter((id) => (family === 'all' || ENGRAVES[id].fits === family) && !s.hero.suit.includes(id));
  const known = s.rng.shuffle(pool.filter((id) => s.records.includes(id)));
  const fresh = s.rng.shuffle(pool.filter((id) => !s.records.includes(id)));
  const recorded = known.splice(0, 2);
  const discovered = fresh.splice(0, 1);
  while (recorded.length + discovered.length < 3 && (known.length || fresh.length)) {
    if (known.length) recorded.push(known.shift()!);
    else discovered.push(fresh.shift()!);
  }
  return [...recorded, ...discovered];
}

/** Remember an engraving the first time a choice puts it on the suit this run. */
export function record(s: GridState, t: number, id: EngraveId): void {
  if (s.records.includes(id)) return;
  s.records.push(id);
  s.events.push({ t, type: 'record', src: s.hero.id, text: id });
}
