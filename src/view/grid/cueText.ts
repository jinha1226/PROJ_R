import type { GEvent } from '../../sim/grid/types';

/** The pop-up over a chest for what came out of it ("+화살 3", "+붉은 물약"). */
/** resources named in Korean on the loot pop-up */
const LOOT_NAME: Record<string, string> = { bio: '생체', ore: '광석', crystal: '마정석' };
export function lootText(e: GEvent): string {
  const name = LOOT_NAME[e.text ?? ''];
  if (name) return `${name} +${e.amount ?? 1}`;
  return e.amount ? `+${e.text} ${e.amount}` : `+${e.text}`;
}
