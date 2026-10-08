import type { GridState } from './types';

/** Refill mana for the main melee hit once and each hero kill during those blows. */
export function refillMelee(s: GridState, landed: boolean, eventStart: number): void {
  const kills = s.events.slice(eventStart).filter((e) => e.type === 'die' && e.src === s.hero.id).length;
  s.hero.charge = Math.min(s.hero.maxCharge, s.hero.charge + Number(landed) + (2 + s.hero.bonus.killCharge) * kills);
}
