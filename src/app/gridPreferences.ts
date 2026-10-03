const PIXEL_KEY = 'projr.grid.pixel';
export const loadPixel = (): boolean => { try { return localStorage.getItem(PIXEL_KEY) !== '0'; } catch { return true; } };
export const savePixel = (on: boolean): void => { try { localStorage.setItem(PIXEL_KEY, on ? '1' : '0'); } catch { /* not kept */ } };
