/** Camera zoom as the ground height (metres) the screen shows top to bottom: smaller is closer. */
export const ZOOM_MIN = 7;
export const ZOOM_MAX = 22;
const KEY = 'projr.zoom';
const WHEEL_RATE = 0.0015;

export type ZoomByLayout = { portrait: number; landscape: number };
export const ZOOM_DEFAULT: ZoomByLayout = { portrait: 15, landscape: 11 };

export const clampZoom = (h: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, h));

/** Fingers that started d0 apart and are now d1 apart: spreading them zooms in by the same ratio. */
export function pinchHeight(start: number, d0: number, d1: number): number {
  return clampZoom(start * (d0 / Math.max(1, d1)));
}

export function wheelHeight(h: number, deltaY: number): number {
  return clampZoom(h * Math.exp(deltaY * WHEEL_RATE));
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const local = (): Store | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** The zoom remembered for each orientation (defaults when nothing usable is stored or storage is blocked). */
export function loadZoom(store: Store | null = local(), key = KEY, defaults: ZoomByLayout = ZOOM_DEFAULT): ZoomByLayout {
  try {
    const v = JSON.parse(store?.getItem(key) ?? 'null') as Partial<ZoomByLayout> | null;
    if (!v || typeof v.portrait !== 'number' || typeof v.landscape !== 'number') return { ...defaults };
    return { portrait: clampZoom(v.portrait), landscape: clampZoom(v.landscape) };
  } catch {
    return { ...defaults };
  }
}

export function saveZoom(z: ZoomByLayout, store: Store | null = local(), key = KEY): void {
  try {
    store?.setItem(key, JSON.stringify(z));
  } catch {
    /* storage blocked: the zoom just isn't remembered */
  }
}
