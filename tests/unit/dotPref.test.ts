import { describe, expect, it } from 'vitest';
import { loadDot, saveDot } from '../../src/app/gridPreferences';

describe('dot look preference', () => {
  it('is on unless turned off, and kept once chosen', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    expect(loadDot()).toBe(true);
    saveDot(false);
    expect(loadDot()).toBe(false);
    saveDot(true);
    expect(loadDot()).toBe(true);
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(loadDot()).toBe(true);
  });
});
