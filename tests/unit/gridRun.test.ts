import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { abandonRun, clearRun, loadRun, saveRun, startGridRun, continueGridRun } from '../../src/app/gridRun';
import { loadMeta } from '../../src/app/gridMeta';
import { GridSim } from '../../src/sim/grid/gridSim';
import { toSave } from '../../src/sim/grid/save';
let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());
it('saves, loads, clears and handles invalid or blocked storage', () => {
  expect(loadRun()).toBeNull();
  const s = GridSim.create(7).s; saveRun(s);
  expect(toSave(loadRun()!)).toBe(toSave(s));
  clearRun(); expect(loadRun()).toBeNull();
  data.set('projr.grid.run.v1', '{}'); expect(loadRun()).toBeNull();
  vi.stubGlobal('localStorage', { getItem: () => { throw Error(); }, setItem: () => { throw Error(); }, removeItem: () => { throw Error(); } });
  expect(loadRun()).toBeNull();
  expect(() => saveRun(s)).not.toThrow();
  expect(() => clearRun()).not.toThrow();
});
it('starts directly with a pistol, checkpoints actions and continues the saved seed', () => {
  const session = startGridRun(33);
  expect(session.sim.s.hero.gear.hands[0]?.group).toBe('pistol');
  expect(session.sim.s.run.floor).toBe(1);
  expect(loadRun()?.seed).toBe(33);
  session.sim.act({ kind: 'wait' }); session.checkpoint();
  expect(toSave(loadRun()!)).toBe(toSave(session.sim.s));
  const continued = continueGridRun()!;
  expect(toSave(continued.sim.s)).toBe(toSave(session.sim.s));
  expect(continued.sim.act({ kind: 'wait' })).toEqual(session.sim.act({ kind: 'wait' }));
});
it('settles once and clears immediately on completion before result rendering', () => {
  const session = startGridRun(4);
  session.sim.s.run.energy = 20;
  session.sim.s.outcome = 'dead'; session.sim.s.hero.suit = ['dash'];
  session.checkpoint(); session.checkpoint();
  expect(loadRun()).toBeNull();
  expect(loadMeta().energy).toBe(20);
  expect(loadMeta().suit?.ids).toEqual(['dash']);
  expect(continueGridRun()).toBeNull();
});
it('keeps the settled result available when storage is blocked', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw Error(); }, setItem: () => { throw Error(); }, removeItem: () => { throw Error(); } });
  const session = startGridRun(4);
  session.sim.s.run.floor = 6; session.sim.s.run.energy = 20; session.sim.s.outcome = 'won';
  session.checkpoint();
  expect(session.meta.best).toBe(6);
  expect(session.meta.wins).toBe(1);
  expect(session.meta.energy).toBe(20);
});

it('a saved run can be given up from the ship: it settles as a death (energy kept) and the save goes', () => {
  const run = startGridRun(11);
  run.sim.s.run.energy = 37;
  run.checkpoint();
  expect(loadRun()).not.toBeNull();
  const meta = abandonRun();
  expect(meta.energy).toBe(37);
  expect(loadRun()).toBeNull();
  expect(loadMeta().energy).toBe(37);
});

it('a save that cannot be continued is dropped instead of blocking new runs', () => {
  data.set('projr.grid.run.v1', JSON.stringify({ seed: 1, time: 0, map: {}, hero: {}, foes: [], run: {} }));
  expect(continueGridRun()).toBeNull();
  expect(data.has('projr.grid.run.v1')).toBe(false);
});
it('settles a returned run once and removes its checkpoint', () => {
  const session = startGridRun(4); session.sim.s.run.stones = ['scatter']; session.sim.s.run.materials.scrap = 7;
  session.sim.s.outcome = 'returned'; session.checkpoint(); session.checkpoint();
  expect(loadRun()).toBeNull(); expect(loadMeta().mods.unlocked).toEqual(['scatter']);
  expect(loadMeta().materials.scrap).toBe(7); expect(loadMeta().wins).toBe(0); expect(loadMeta().coreSecured).toBe(false);
});
