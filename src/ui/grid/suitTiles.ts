import { ENGRAVES, fitsHand, SUIT_SLOTS, type EngraveId } from '../../sim/grid/engraveCore';
import type { GridState } from '../../sim/grid/types';

export interface SuitTile { id: EngraveId | null; name: string; lit: boolean }

export function suitTiles(s: GridState): SuitTile[] {
  return Array.from({ length: SUIT_SLOTS }, (_, i) => {
    const id = s.hero.suit[i] ?? null;
    return { id, name: id ? ENGRAVES[id].name : '빈 슬롯', lit: id !== null && fitsHand(s, id) };
  });
}
