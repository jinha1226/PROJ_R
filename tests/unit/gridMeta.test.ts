import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadMeta, saveMeta } from '../../src/app/gridMeta';
import { freshMeta } from '../../src/sim/grid/meta';
let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
});
afterEach(() => vi.unstubAllGlobals());
it('migrates legacy records once and round trips all meta fields', () => {
  data.set('projr.grid.v1', JSON.stringify({ best: 8, wins: 2 }));
  const m = loadMeta();
  expect(m).toEqual({ ...freshMeta(), best: 8, wins: 2 });
  expect(data.has('projr.grid.meta.v1')).toBe(true);
  m.energy = 90; m.facilities.armoryShotgun = true;
  m.suit = { floor: 3, ids: ['dash'], killer: { kind: 'minion' } };
  saveMeta(m);
  data.set('projr.grid.v1', JSON.stringify({ best: 15, wins: 20 }));
  expect(loadMeta()).toEqual(m);
});
it('survives corrupt data and unavailable storage', () => {
  data.set('projr.grid.meta.v1', '{bad');
  expect(loadMeta()).toEqual(freshMeta());
  vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('full'); } });
  expect(loadMeta()).toEqual(freshMeta());
  expect(() => saveMeta(freshMeta())).not.toThrow();
});
