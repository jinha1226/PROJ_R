import { emit } from './kataBus';
import type { Ent, GridState } from './types';

/** Scope pre-hit boosts to this target, including sweep and reflex blows. Thaw only on a hit. */
export function preMelee(s: GridState, t: number, foe: Ent, hit: () => boolean, base = s.hero.fx.nextMult): boolean {
  const saved = s.hero.fx.nextMult, afterHit: (() => void)[] = [];
  s.hero.fx.nextMult = base;
  emit(s, 'preMelee', { t, foe, afterHit });
  const landed = hit();
  if (landed) afterHit.forEach(resolve => resolve());
  s.hero.fx.nextMult = saved;
  return landed;
}
