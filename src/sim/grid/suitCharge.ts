import type { GridState } from './types';

/** Reward the main melee hit once and each hero kill resolved during those blows. */
export function refillMelee(s: GridState, landed: boolean, eventStart: number): void {
  const kills = s.events.slice(eventStart).filter((e) => e.type === 'die' && e.src === s.hero.id).length;
  s.hero.charge = Math.min(s.hero.maxCharge, s.hero.charge + Number(landed) + 2 * kills);
}

/** game time per charge the suit gains on its own (so a pistol is never wholly dry) */
export const SELF_CHARGE_EVERY = 3;

/** The suit trickles charge back over game time, up to its maximum. */
export function selfCharge(s: GridState, spent: number): void {
  const h = s.hero;
  h.chargeClock = (h.chargeClock ?? 0) + spent;
  while (h.chargeClock >= SELF_CHARGE_EVERY - 1e-9 && h.charge < h.maxCharge) {
    h.chargeClock -= SELF_CHARGE_EVERY;
    h.charge++;
  }
  // a full suit does not bank time toward later
  if (h.charge >= h.maxCharge) h.chargeClock = 0;
}
