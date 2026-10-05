import { applyMods } from './mods';
import { refreshSight } from './state';
import { placeDeathSuit } from './deathSuit';
import type { EngraveId } from './engraveCore';
import type { Round } from './rounds';
import type { MetaState } from './meta';
import { generateMap } from './mapgen';
import { scatterLoot } from './consumables';
import { LEVEL_HP, XP_STEPS } from './run';
import { newState } from './state';
import type { GridState } from './types';

export interface RunOptions { gun: 'pistol'; round?: Round; start: 1 | 6 | 11; startSuit: EngraveId[] }
export function allowedStart(meta: MetaState, start: RunOptions['start']): RunOptions['start'] {
  return start !== 1 && meta.repairs.includes('nav') && (meta.portals ?? []).includes(start - 1) ? start : 1;
}
export function newRunState(seed: number, meta: MetaState, opts: RunOptions): GridState {
  opts = { ...opts, start: allowedStart(meta, opts.start) };
  const s = newState(generateMap(opts.start === 1 ? seed : seed * 31 + opts.start, opts.start), seed, 'pistol', opts.start);
  s.run.modsUnlocked = [...(meta.mods.unlocked ?? [])];
  s.run.stock = { ...meta.materials };
  s.run.tools = [...meta.tools];
  s.records = [...meta.records];
  s.run.unlocked = [...meta.unlocked];
  const h = s.hero;
  h.rounds = opts.round && opts.round !== 'plain' && meta.rounds.includes(opts.round) ? [opts.round] : [];
  h.maxCharge = h.charge = 10 + 2 * meta.facilities.chargePlus;
  h.level = opts.start === 1 ? 1 : opts.start === 6 ? 4 : 7;
  h.xp = h.level === 1 ? 0 : XP_STEPS[h.level - 2]!;
  h.maxHp += (h.level - 1) * LEVEL_HP;
  h.hp = h.maxHp;
  h.suit = opts.start === 1 ? [...new Set(opts.startSuit.length ? opts.startSuit : meta.unlocked)].filter(id => meta.unlocked.includes(id)).slice(0, meta.facilities.suitSlots) : [];
  applyMods(h, meta);
  refreshSight(s);
  s.floorItems.push(...scatterLoot(s));
  if (meta.suit) s.run.leftSuit = structuredClone(meta.suit);
  placeDeathSuit(s);
  return s;
}
