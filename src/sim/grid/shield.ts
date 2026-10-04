import type { Ent, GridState } from './types';

/** Armour is resolved first; only remaining damage reaches the shield and then HP. */
export function absorbShield(s: GridState, t: number, dst: Ent, amount: number): number {
  if (dst !== s.hero) return amount;
  const absorbed = Math.min(s.hero.shield ?? 0, amount);
  if (absorbed > 0) {
    s.hero.shield = (s.hero.shield ?? 0) - absorbed;
    s.events.push({ t, type: 'shield', src: dst.id, amount: absorbed, to: { ...dst.pos } });
  }
  return amount - absorbed;
}
