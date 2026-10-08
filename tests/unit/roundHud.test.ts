import { shotGroup } from '../../src/view/grid/runtimeHelpers';
import { expect, it } from 'vitest';
import { weaponLabel } from '../../src/ui/grid/weaponInfo';
import { termArms } from '../../src/ui/grid/gridTerm';
import { makeWeapon } from '../../src/sim/grid/items';
import { newState } from '../../src/sim/grid/state';
import { handMap, OPEN } from '../sim/grid/kit';
it('both HUD weapon lines show the loaded element and melee keeps its name', () => {
  const s = newState(handMap(OPEN), 1); s.hero.rounds = ['fire', 'frost'];
  expect(weaponLabel(makeWeapon('bow', 1), s.hero)).toBe('사냥 활 · 화염');
  expect(termArms(s)).toContain('사냥 활 · 화염');
  s.hero.roundIdx = 1;
  expect(weaponLabel(makeWeapon('bow', 1), s.hero)).toBe('사냥 활 · 빙결');
  expect(termArms(s)).toContain('사냥 활 · 빙결');
  expect(weaponLabel(makeWeapon('sword', 1), s.hero)).toBe('장검');
});
it('keeps enemy spell events unarmed', () => {
  expect(shotGroup({ t: 0, type: 'shoot', text: 'spell' })).toBe('none');
});
