import { emit } from './kataBus';
import { emitKills } from './attackTriggers';
import type { Weapon } from './items';
import type { Ent, GridState } from './types';
import type { ShotHooks } from './weapons';

export const REFLEX_HOOKS: ShotHooks = { noise: () => {}, cast: () => 1 };
export const otherHand = (s: GridState): Weapon | null => s.hero.gear.hands[s.hero.gear.active === 0 ? 1 : 0];

/** Restore the original hand even if a nested attack or hook throws. */
export function withOtherHand<T>(s: GridState, fn: () => T): T {
  const g = s.hero.gear;
  const was = g.active;
  g.active = was === 0 ? 1 : 0;
  try { return fn(); } finally { g.active = was; }
}

/** Compatibility entry points; definitions and eligibility live on the bus. */
export function gunRelay(s: GridState, t: number, start: number, hooks?: ShotHooks): void {
  emitKills(s, t, start, 'meleeKill', hooks);
}
export function onStunned(s: GridState, t: number, foe: Ent): void {
  emit(s, 'stunned', { t, foe });
}
