const FADE = 6;
export const MAX_DARK = 0.82;

/** Darkness at distance d from the hero for a sight radius r: clear inside, smooth fade to MAX_DARK. */
export function visionAlpha(d: number, r: number): number {
  if (d <= r) return 0;
  const t = Math.min(1, (d - r) / FADE);
  return MAX_DARK * t * t * (3 - 2 * t);
}
