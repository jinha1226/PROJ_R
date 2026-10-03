/** Camera height (world units of view) that fits a deck of `w` × `h` cells with a cell of margin, for a screen aspect (width / height). */
export function shipZoom(w: number, h: number, aspect: number): number {
  return Math.max(h + 1, (w + 1) / Math.max(0.1, aspect));
}
