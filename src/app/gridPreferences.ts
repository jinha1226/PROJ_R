const PIXEL_KEY = 'projr.grid.pixel';
export const loadPixel = (): boolean => { try { return localStorage.getItem(PIXEL_KEY) !== '0'; } catch { return true; } };
// a new key: the palette dot look starts on even where the old plain one was turned off
const DOT_KEY = 'projr.dot.v2';
/** The dot (pixel) look on the expedition screens: the game's look, on unless turned off. */
export const loadDot = (): boolean => { try { return localStorage.getItem(DOT_KEY) !== '0'; } catch { return true; } };
export const saveDot = (on: boolean): void => { try { localStorage.setItem(DOT_KEY, on ? '1' : '0'); } catch { /* not kept */ } };
export const savePixel = (on: boolean): void => { try { localStorage.setItem(PIXEL_KEY, on ? '1' : '0'); } catch { /* not kept */ } };
