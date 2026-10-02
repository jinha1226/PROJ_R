/** How fast a model catches up with its logical position: the gap halves every ln2/k seconds, so lag stays bounded however fast you play. */
export const CHASE_K = 18;

export function chase(cur: number, target: number, dt: number, k = CHASE_K): number {
  return target + (cur - target) * Math.exp(-k * dt);
}
