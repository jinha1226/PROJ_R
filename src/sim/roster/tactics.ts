import type { TacticId } from '../../data/types';
import { rankOf, type Roster } from './types';

export const tacticSlots = (level: number): number => (rankOf(level) === 'veteran' || rankOf(level) === 'hero' ? 2 : 1);

/** Puts an owned tactic card into a slot (0 or 1); slot 1 needs veteran rank; no duplicates. */
export function setTactic(r: Roster, mercId: string, slot: number, tactic: TacticId): Roster {
  const m = r.mercs.find((x) => x.id === mercId);
  if (!m) throw new Error('unknown merc');
  if (slot >= tacticSlots(m.level)) throw new Error('tactic slot locked');
  if (!r.tacticsOwned.includes(tactic)) throw new Error('tactic not owned');
  if (m.tactics.some((t, i) => t === tactic && i !== slot)) throw new Error('tactic already equipped');
  const tactics = [...m.tactics];
  tactics[slot] = tactic;
  return { ...r, mercs: r.mercs.map((x) => (x.id === mercId ? { ...x, tactics: tactics.filter(Boolean) } : x)) };
}
