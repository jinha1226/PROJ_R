import { afterEach, expect, it, vi } from 'vitest';
import { freshMeta } from '../../src/sim/grid/meta';
import { startGridRun, loadRun, continueGridRun } from '../../src/app/gridRun';
afterEach(() => vi.unstubAllGlobals());
it('launches ship selections, resumes, settles, and launches again with returned meta even without storage', () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw Error(); }, removeItem: () => {} });
  const meta = freshMeta(); meta.facilities.armoryRifle = true; meta.facilities.navCrypt = true;
  const run = startGridRun(33, { gun: 'rifle', start: 6, startSuit: [] }, meta);
  expect(run.sim.s.run.floor).toBe(6); expect(run.sim.s.hero.gear.hands[0]?.group).toBe('rifle');
  run.sim.s.run.energy = 150; run.sim.s.outcome = 'dead'; run.checkpoint();
  expect(run.meta.energy).toBe(150);
  const next = startGridRun(34, { gun: 'rifle', start: 6, startSuit: [] }, run.meta);
  expect(next.meta.energy).toBe(150);
  expect(next.sim.s.run.floor).toBe(6);
});
it('continues the saved run independently of new ship equipment selections', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  const meta = freshMeta(); meta.facilities.armoryShotgun = true; meta.startCandidates = ['rapid'];
  startGridRun(9, { gun: 'shotgun', start: 1, startSuit: ['rapid'] }, meta);
  expect(loadRun()?.hero.suit).toEqual(['rapid']);
  expect(continueGridRun()?.sim.s.hero.gear.hands[0]?.group).toBe('shotgun');
});
