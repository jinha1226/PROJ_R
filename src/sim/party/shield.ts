import type { Unit } from './partyCore';
export const SHIELD_CAP = 30;
export function addShield(u: Unit, amount: number): void {
  u.shield = Math.min(SHIELD_CAP, Math.max(0, u.shield + amount));
}
