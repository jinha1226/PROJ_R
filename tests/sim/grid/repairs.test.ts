import { expect, it } from 'vitest';
import { freshMeta, buy, settleRun } from '../../../src/sim/grid/meta';
import { SYSTEMS, canRepair, repair } from '../../../src/sim/grid/repairs';
import { migrateBaseMeta } from '../../../src/sim/grid/baseMigration';
import { stationLit } from '../../../src/view/grid/stationLit';
import { newRunState } from '../../../src/sim/grid/runSetup';
it('enforces needs, spends exact costs and grants tools once', () => {
  const m = freshMeta(); m.materials = { scrap: 100, soul: 100, relic: 100, remains: 100 };
  expect(repair(m, 'nav')).toBe(false); expect(repair(m, 'pod')).toBe(false);
  for (const id of ['workbench', 'suitlab', 'nav', 'lifeSupport', 'pod'] as const) {
    const before = { ...m.materials }; expect(canRepair(m, id)).toBe(true); expect(repair(m, id)).toBe(true);
    for (const [mat, n] of Object.entries(SYSTEMS[id].cost)) expect(m.materials[mat as keyof typeof before]).toBe(before[mat as keyof typeof before] - n);
    expect(repair(m, id)).toBe(false);
  }
  expect(m.tools).toEqual(['cutter', 'grapple', 'scanner']); expect(repair(m, 'core')).toBe(false);
  m.coreSecured = true; expect(repair(m, 'core')).toBe(true); expect(m.departed).toBe(true);
});
it('requires materials and records the won core', () => {
  const m = freshMeta(); expect(repair(m, 'workbench')).toBe(false);
  const s = newRunState(1, m, { gun: 'pistol', start: 1, startSuit: [] }); s.outcome = 'won';
  expect(settleRun(m, s).coreSecured).toBe(true);
});
it('gates energy shops and station power by repair', () => {
  const m = freshMeta(); m.energy = 2000; m.bossesKilled = [5, 10];
  for (const id of ['round:fire', 'suitSlots3', 'chargePlus1', 'navCrypt', 'engrave:flow']) expect(buy(m, id)).toBe(false);
  expect(stationLit(m, 'armory')).toBe(false); expect(stationLit(m, 'core')).toBe(false);
  for (const id of ['pod', 'records', 'hatch'] as const) expect(stationLit(m, id)).toBe(true);
  m.repairs = ['workbench', 'suitlab', 'nav'];
  for (const id of ['round:fire', 'suitSlots3', 'chargePlus1', 'navCrypt', 'engrave:flow']) expect(buy(m, id)).toBe(true);
  expect(stationLit(m, 'armory')).toBe(true);
});
it('migrates only legacy progress and preserves explicit repair state', () => {
  const old = JSON.parse(JSON.stringify(freshMeta())); delete old.repairs; delete old.tools;
  old.rounds = ['fire']; old.facilities.suitSlots = 3;
  const migrated = migrateBaseMeta(old);
  expect(migrated.repairs).toEqual(expect.arrayContaining(['workbench', 'suitlab']));
  expect(migrated.tools).toEqual(expect.arrayContaining(['cutter', 'grapple']));
  expect(migrateBaseMeta(freshMeta()).repairs).toEqual([]);
});
