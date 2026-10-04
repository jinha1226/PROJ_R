import { expect, it } from 'vitest';
import { weaponLabel } from '../../src/ui/grid/weaponInfo';
import { termArms } from '../../src/ui/grid/gridTerm';
import { makeWeapon } from '../../src/sim/grid/items';
import { newState } from '../../src/sim/grid/state';
import { handMap, OPEN } from '../sim/grid/kit';
it('both HUD weapon lines show the loaded element and melee keeps its name', () => {
  const s = newState(handMap(OPEN), 1); s.hero.rounds = ['fire', 'frost'];
  expect(weaponLabel(makeWeapon('pistol', 1), s.hero)).toBe('권총 · 화염');
  expect(termArms(s)).toContain('권총 · 화염');
  s.hero.roundIdx = 1;
  expect(weaponLabel(makeWeapon('pistol', 1), s.hero)).toBe('권총 · 빙결');
  expect(termArms(s)).toContain('권총 · 빙결');
  expect(weaponLabel(makeWeapon('sword', 1), s.hero)).toBe('장검');
});
it('keeps enemy spell events unarmed after removing the staff look', async () => {
  const { shotGroup } = await import('../../src/view/grid/runtimeHelpers');
  expect(shotGroup({ t: 0, type: 'shoot', text: 'spell' })).toBe('none');
});
