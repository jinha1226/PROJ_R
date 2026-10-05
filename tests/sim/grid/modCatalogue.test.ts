import { expect, it } from 'vitest';
import { freshMeta } from '../../../src/sim/grid/meta';
import { applyMods, canCraft, MODS } from '../../../src/sim/grid/mods';
import { migrateBaseMeta } from '../../../src/sim/grid/baseMigration';
import { workbenchModel } from '../../../src/sim/grid/workbench';
import { GridSim } from '../../../src/sim/grid/gridSim';

it('has 24 regular mods, three per slot and eight craftable base mods', () => {
  const mods = MODS.filter(m => m.slot !== 'heart');
  expect(mods).toHaveLength(24);
  expect(mods.filter(m => !m.stone)).toHaveLength(8);
  const model = workbenchModel(freshMeta());
  for (const { slot } of model.slots) expect(model.options(slot)).toHaveLength(3);
  expect(model.options('heart')).toEqual([]);
});
it('requires stone discovery before crafting and exposes locked options', () => {
  const m = freshMeta(); m.repairs = ['workbench']; m.materials = { scrap: 100, soul: 100, relic: 100, remains: 100 };
  expect(canCraft(m, 'soulCell')).toBe(false);
  expect(workbenchModel(m).options('mag').find(o => o.mod.id === 'soulCell')?.locked).toBe(true);
  m.mods.unlocked.push('soulCell');
  expect(canCraft(m, 'soulCell')).toBe(true);
  expect(workbenchModel(m).options('mag').find(o => o.mod.id === 'soulCell')?.locked).toBe(false);
});
it('migrates old owned stones, drops removed ids and filters unlocks', () => {
  const m = freshMeta(); m.mods.owned = ['soulCell', 'heavyBarrel'];
  m.mods.unlocked = ['missing', 'longBarrel'];
  m.mods.fitted = { mag: 'soulCell', barrel: 'heavyBarrel' };
  expect(migrateBaseMeta(m).mods).toEqual({ owned: ['soulCell'], unlocked: ['soulCell'], fitted: { mag: 'soulCell' } });
});
it('applies perks from valid fitted slots alongside stats', () => {
  const m = freshMeta(); m.mods.fitted = { mag: 'soulCell', chest: 'plating', sight: 'runeScope' };
  const h = GridSim.create(3).s.hero; applyMods(h, m);
  expect(h.perks).toEqual(['soulCell', 'runeScope']);
  expect(h.maxHp).toBe(41); expect(h.maxCharge).toBe(10);
});
