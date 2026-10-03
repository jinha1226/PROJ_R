import type { GEvent } from '../../sim/grid/types';

/** The pop-up over a chest for what came out of it ("+화살 3", "+붉은 물약"). */
export function lootText(e: GEvent): string {
  return e.amount ? `+${e.text} ${e.amount}` : `+${e.text}`;
}
