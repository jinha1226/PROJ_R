import { expect, it } from 'vitest';
import { freshMeta } from '../../../src/sim/grid/meta';
import { workbenchModel } from '../../../src/sim/grid/workbench';
import type { WorkbenchModel } from '../../../src/ui/grid/ship/workbenchTypes';
it('matches the UI shape, reports costs and previews without mutating meta', () => {
  const m = freshMeta(); m.materials.scrap = 2;
  const before = structuredClone(m), model: WorkbenchModel = workbenchModel(m);
  expect(model.open).toBe(false); expect(model.slots.map(s => s.slot)).toEqual(['barrel', 'mag', 'sight', 'grip', 'chest', 'arms', 'legs', 'back']);
  expect(model.options('barrel')[0]).toMatchObject({ owned: false, craftable: false, missing: { scrap: 2 }, fitted: false });
  const preview = model.stats({ slot: 'barrel', mod: 'longBarrel' });
  expect(preview.find(s => s.label === '명중')).toEqual({ label: '명중', now: 0.9, next: 0.98 });
  expect(preview.find(s => s.label === '소음')?.next).toBe(4); expect(m).toEqual(before);
  model.materials.scrap = 999; expect(m).toEqual(before);
});
it('includes existing charge upgrades, sums slots and previews replacement/unfit', () => {
  const m = freshMeta(); m.facilities.chargePlus = 2; m.mods.owned = ['longBarrel', 'redDot'];
  m.mods.fitted = { barrel: 'longBarrel', sight: 'redDot' }; m.repairs = ['workbench'];
  const model = workbenchModel(m); expect(model.open).toBe(true);
  expect(model.stats().find(s => s.label === '충전')?.now).toBe(14);
  expect(model.stats({ slot: 'barrel', mod: null }).find(s => s.label === '명중')?.next).toBeCloseTo(1);
  expect(model.options('barrel')[0]).toMatchObject({ owned: true, fitted: true, craftable: false });
});
