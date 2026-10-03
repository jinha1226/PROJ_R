/** Camera height (world units of view) that fits a deck of `w` × `h` cells with a cell of margin, for a screen aspect (width / height). */
export function shipZoom(w: number, h: number, aspect: number): number {
  // room for the labels above the top row and the deck HUD in the corner
  return Math.max(h + 3.5, (w + 2) / Math.max(0.1, aspect));
}
