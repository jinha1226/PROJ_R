const PIXEL_KEY = 'projr.grid.pixel';
export const loadPixel = (): boolean => { try { return localStorage.getItem(PIXEL_KEY) !== '0'; } catch { return true; } };
const DOT_KEY = 'projr.dot';
/** The dot (pixel) look on the expedition screens: off unless chosen. */
export const loadDot = (): boolean => { try { return localStorage.getItem(DOT_KEY) === '1'; } catch { return false; } };
export const saveDot = (on: boolean): void => { try { localStorage.setItem(DOT_KEY, on ? '1' : '0'); } catch { /* not kept */ } };
export const savePixel = (on: boolean): void => { try { localStorage.setItem(PIXEL_KEY, on ? '1' : '0'); } catch { /* not kept */ } };
