export type Layout = 'portrait' | 'landscape';

/** Taller than wide is portrait (a phone held upright); everything else is landscape. */
export const layoutOf = (w: number, h: number): Layout => (h > w ? 'portrait' : 'landscape');

/** Default camera view height (metres of ground top to bottom): close enough that the party reads well on a phone. */
export const DEFAULT_VIEW: Record<Layout, number> = { portrait: 15, landscape: 11 };

/** Calls back now and whenever the screen turns; returns the unsubscribe. */
export function watchLayout(cb: (l: Layout) => void): () => void {
  let cur = layoutOf(window.innerWidth, window.innerHeight);
  cb(cur);
  const on = (): void => {
    const l = layoutOf(window.innerWidth, window.innerHeight);
    if (l === cur) return;
    cur = l;
    cb(l);
  };
  window.addEventListener('resize', on);
  return () => window.removeEventListener('resize', on);
}
