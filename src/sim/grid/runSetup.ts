import { placeDeathSuit } from './deathSuit';
import type { EngraveId } from './engraveCore';
import type { GunGroup } from './items';
import type { MetaState } from './meta';
import { generateMap } from './mapgen';
import { scatterLoot } from './consumables';
import { LEVEL_HP, XP_STEPS } from './run';
import { newState } from './state';
import type { GridState } from './types';

export interface RunOptions { gun: GunGroup; start: 1 | 6 | 11; startSuit: EngraveId[] }
export function newRunState(seed: number, meta: MetaState, opts: RunOptions): GridState {
  const s = newState(generateMap(opts.start === 1 ? seed : seed * 31 + opts.start, opts.start), seed, opts.gun, opts.start);
  s.records = [...meta.records];
  s.run.unlocked = [...meta.unlocked];
  const h = s.hero;
  h.maxCharge = h.charge = 10 + 2 * meta.facilities.chargePlus;
  h.level = opts.start === 1 ? 1 : opts.start === 6 ? 4 : 7;
  h.xp = h.level === 1 ? 0 : XP_STEPS[h.level - 2]!;
  h.maxHp += (h.level - 1) * LEVEL_HP;
  h.hp = h.maxHp;
  h.suit = opts.start === 1 ? [...new Set(opts.startSuit.length ? opts.startSuit : meta.unlocked)].filter(id => meta.unlocked.includes(id)).slice(0, meta.facilities.suitSlots) : [];
  s.floorItems.push(...scatterLoot(s));
  if (meta.suit) s.run.leftSuit = structuredClone(meta.suit);
  placeDeathSuit(s);
  return s;
}
