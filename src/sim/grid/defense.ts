import { emit } from './kataBus';
import { activeWeapon } from './gear';
import { counterBlow } from './combos';
import type { GridState } from './types';

const BASE_EVASION = 0.05;
const DAGGER_EVASION = 0.1;
const LIGHT_EVASION = 0.05;
const SWORD_PARRY = 0.12;

/** Chance to weave out of a foe's blow or shot: 5%, +10% with a dagger in hand, +5% in leather or no armour. */
export function evasionOf(s: GridState): number {
  const g = s.hero.gear;
  return BASE_EVASION + s.hero.bonus.evasion + (activeWeapon(g)?.group === 'dagger' ? DAGGER_EVASION : 0) + ((g.armor?.reduce ?? 0) <= 1 ? LIGHT_EVASION : 0);
}

/** Chance to turn a melee blow aside with a sword in hand. */
export function parryOf(s: GridState): number {
  return activeWeapon(s.hero.gear)?.group === 'sword' ? SWORD_PARRY : 0;
}

/**
 * A foe's attack aimed at the hero: parry (melee only) or dodge, before the hit roll. Emits the event and
 * returns what happened; null means the blow goes on to roll as usual.
 */
export function defend(s: GridState, t: number, src: string, kind: 'melee' | 'shot'): 'parry' | 'dodge' | null {
  const p = kind === 'melee' ? parryOf(s) : 0;
  if (p > 0 && s.rng.chance(p)) {
    s.events.push({ t, type: 'parry', src: s.hero.id, dst: src, to: { ...s.hero.pos } });
    emit(s, 'parry', { t, src, foe: s.foes.find(f => f.id === src) });
    counterBlow(s, t, src, 'parry');
    return 'parry';
  }
  if (s.rng.chance(evasionOf(s))) {
    s.events.push({ t, type: 'dodge', src: s.hero.id, dst: src, to: { ...s.hero.pos }, text: s.rng.chance(0.5) ? 'L' : 'R' });
    emit(s, 'dodge', { t, src, foe: s.foes.find(f => f.id === src) });
    counterBlow(s, t, src, 'dodge');
    return 'dodge';
  }
  return null;
}
