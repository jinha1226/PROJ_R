import { TRAITS } from './traitDefs';

/** A card's line at a rank: its rule, the upgrade's addition at rank 2, and an oath's price. Empty for unknown ids. */
export function traitText(id: string, rank: number): string {
  const d = TRAITS[id];
  if (!d?.text) return '';
  const line = rank >= 2 && d.up ? `${d.text} · 강화: ${d.up}` : d.text;
  return d.cost ? `${line} · 대가: ${d.cost}` : line;
}
