import { TRAITS } from './traitDefs';
import type { TraitDef } from './traitTypes';

/** A card's line at a rank: its rule, the upgrade's addition at rank 2, and an oath's price. Empty for unknown ids. */
export function traitText(id: string, rank: number): string {
  const d = TRAITS[id];
  if (!d?.text) return '';
  const line = d.text + (rank >= 2 && d.up ? ` · 강화: ${d.up}` : '') + (rank >= 3 && d.up3 ? ` · 3단: ${d.up3}` : '');
  return d.cost ? `${line} · 대가: ${d.cost}` : line;
}

/** What the next pick of a card adds: rank 1 → its upgrade, rank 2 → its third-rank effect. */
export const upText = (d: TraitDef, rank: number): string | undefined => (rank >= 2 ? d.up3 : d.up);
