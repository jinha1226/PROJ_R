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
  m.energy = 90; m.rounds = ['fire'];
  m.suit = { materials: freshMeta().materials, floor: 3, ids: ['dash'], killer: { kind: 'minion' } };
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
it.each([1, 2, 3])('migrates old slot count %i once', slots => {
  const old: Partial<ReturnType<typeof freshMeta>> = freshMeta();
  delete old.unlocked; delete old.tasted;
  data.set('projr.grid.meta.v1', JSON.stringify({ ...old, facilities: { ...old.facilities, suitSlots: slots } }));
  const m = loadMeta();
  expect(m.facilities.suitSlots).toBe(slots + 1);
  expect(m.unlocked).toEqual(['gunRelay', 'spinShot']); expect(m.tasted).toEqual([]);
  saveMeta(m); expect(loadMeta()).toEqual(m);
});
it('validates new engraving arrays and fills partial facilities', () => {
  data.set('projr.grid.meta.v1', JSON.stringify({ ...freshMeta(), unlocked: ['flow', 'flow', 'bogus', 'rapid'], tasted: ['execute', 42], facilities: { suitSlots: 4 } }));
  expect(loadMeta()).toMatchObject({ unlocked: ['flow', 'rapid'], tasted: ['execute'], facilities: { suitSlots: 4, chargePlus: 0 } });
});
it('ignores old gun flags and validates round unlocks and all engraving lists', () => {
  const old = { ...freshMeta(), rounds: ['fire', 'bogus', 'fire', 'shock'],
    facilities: { ...freshMeta().facilities, armoryShotgun: true, armoryRifle: true },
    records: ['dash', 'gone'], startCandidates: ['gone'], suit: { floor: 2, ids: ['echo', 'gone'], killer: { kind: 'mage' } } };
  data.set('projr.grid.meta.v1', JSON.stringify(old)); const m = loadMeta();
  expect(m.rounds).toEqual(['fire', 'shock']); expect(m.facilities).not.toHaveProperty('armoryShotgun');
  expect(m.records).toEqual(['dash']); expect(m.startCandidates).toEqual([]); expect(m.suit?.ids).toEqual(['echo']);
  delete (old as { rounds?: unknown }).rounds; data.set('projr.grid.meta.v1', JSON.stringify(old));
  expect(loadMeta().rounds).toEqual([]);
});
it('round trips repaired systems, tools, crafted/fitted mods and suit materials', async () => {
  const { repair } = await import('../../src/sim/grid/repairs');
  const { craft, fit } = await import('../../src/sim/grid/mods');
  const m = freshMeta(); m.materials = { scrap: 100, soul: 100, relic: 100, remains: 100 }; m.coreSecured = true;
  for (const id of ['workbench', 'suitlab', 'nav', 'lifeSupport', 'pod', 'core'] as const) expect(repair(m, id)).toBe(true);
  expect(craft(m, 'plating')).toBe(true); expect(fit(m, 'chest', 'plating')).toBe(true);
  m.suit = { floor: 2, ids: [], materials: { scrap: 1, soul: 2, relic: 3, remains: 4 }, killer: { kind: 'minion' } };
  saveMeta(m); expect(loadMeta()).toEqual(m);
});
it('preserves pre-round armory purchases and navigation progress as repairs', () => {
  const old = JSON.parse(JSON.stringify(freshMeta())); delete old.repairs; delete old.tools;
  old.facilities.armoryShotgun = true; old.facilities.navCrypt = true; old.facilities.chargePlus = 1;
  data.set('projr.grid.meta.v1', JSON.stringify(old));
  expect(loadMeta().repairs).toEqual(expect.arrayContaining(['workbench', 'suitlab', 'nav']));
  old.facilities.navCrypt = false; old.facilities.chargePlus = 0;
  data.set('projr.grid.meta.v1', JSON.stringify(old)); expect(loadMeta().repairs).toEqual(['workbench']);
});
it('migrates navigation purchases into portals and round-trips unlocked fitted hearts', () => {
  const m = freshMeta();
  data.set('projr.grid.meta.v1', JSON.stringify({ ...m, portals: [10, 99], facilities: { ...m.facilities, navCrypt: true } }));
  const migrated = loadMeta(); expect(migrated.portals).toEqual([10, 5]); expect(migrated.facilities).not.toHaveProperty('navCrypt');
  migrated.mods.unlocked = ['undyingHeart']; migrated.mods.fitted = { heart: 'undyingHeart' };
  saveMeta(migrated); expect(loadMeta()).toEqual(migrated);
});
