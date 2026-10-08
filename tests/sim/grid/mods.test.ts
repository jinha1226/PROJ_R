import { expect, it, vi } from 'vitest';
import { freshMeta } from '../../../src/sim/grid/meta';
import { MODS, craft, fit } from '../../../src/sim/grid/mods';
import { newRunState } from '../../../src/sim/grid/runSetup';
import { fromSave, toSave } from '../../../src/sim/grid/save';
import { nextFloor } from '../../../src/sim/grid/run';
import { swapCombo } from '../../../src/sim/grid/combos';
import { rangedAttack } from '../../../src/sim/grid/weapons';
import { sim, OPEN } from './kit';
it('crafts once after repair and fits owned mods only in their own slot', () => {
  const m = freshMeta(); expect(craft(m, 'longBarrel')).toBe(false);
  m.materials.scrap = 8; expect(craft(m, 'longBarrel')).toBe(false);
  m.repairs = ['workbench']; expect(craft(m, 'missing')).toBe(false);
  expect(craft(m, 'longBarrel')).toBe(true); expect(m.materials.scrap).toBe(4);
  expect(craft(m, 'longBarrel')).toBe(false); expect(craft(m, 'soulCell')).toBe(false);
  expect(fit(m, 'barrel', 'redDot')).toBe(false); expect(fit(m, 'sight', 'longBarrel')).toBe(false);
  expect(fit(m, 'barrel', 'longBarrel')).toBe(true); expect(fit(m, 'barrel', null)).toBe(true);
  expect(m.mods.fitted).toEqual({}); expect(MODS.filter(m => m.slot !== 'heart')).toHaveLength(24);
});
it('applies all fitted stats once across floor changes and saves', () => {
  const m = freshMeta(); m.mods.owned = MODS.map(m => m.id);
  for (const mod of MODS.filter(m => !m.stone)) fit(m, mod.slot, mod.id);
  const s = newRunState(3, m, { gun: 'bow', start: 1, startSuit: [] });
  expect(s.hero.maxCharge).toBe(12); expect(s.hero.charge).toBe(12); expect(s.hero.shield).toBe(0);
  expect(s.hero.bonus).toMatchObject({ gunDmg: 0, meleeDmg: 2, evasion: 0.05 });
  expect(s.hero.modStats).toMatchObject({ hit: 0.18, noise: -2, swap: -0.25 });
  nextFloor(s); const restored = fromSave(toSave(s)); expect(restored.hero).toEqual(s.hero);
  expect(restored.hero.maxCharge).toBe(12); expect(restored.hero.shield).toBe(0);
});
it('uses mod hit, shot noise and swap time in combat', () => {
  const g = sim(OPEN, { x: 1, y: 1 }, [{ kind: 'brute', pos: { x: 3, y: 1 } }]);
  const noise = vi.fn(); g.s.hero.modStats = { hit: 0.08, noise: -2, swap: -0.25 };
  const chance = vi.spyOn(g.s.rng, 'chance').mockReturnValue(false);
  rangedAttack(g.s, 0, g.s.foes[0]!, { noise });
  expect(noise).toHaveBeenCalledWith(g.s.hero.pos, 2); expect(chance.mock.calls.some(([p]) => p >= 0.9)).toBe(true);
  expect(swapCombo(g.s, 0, { noise })).toBe(0.25);
});
it('applies plating HP and stacked sight bonuses to each fresh run independently', () => {
  const m = freshMeta(); m.mods.owned = ['plating', 'longBarrel', 'redDot']; m.portals = [5, 10]; m.repairs = ['nav'];
  fit(m, 'chest', 'plating'); fit(m, 'barrel', 'longBarrel'); fit(m, 'sight', 'redDot');
  for (const start of [1, 6, 11] as const) {
    const a = newRunState(3, m, { gun: 'bow', start, startSuit: [] });
    const b = newRunState(3, m, { gun: 'bow', start, startSuit: [] });
    expect(a.hero.hp).toBe(35 + (a.hero.level - 1) * 5 + 6); expect(a.hero.hp).toBe(a.hero.maxHp);
    expect(a.hero.modStats?.hit).toBeCloseTo(0.18); expect(a.hero).toEqual(b.hero);
    expect(fromSave(toSave(a)).hero.hp).toBe(a.hero.hp);
  }
});
it('quick grip preserves free quickswap and positive swapstrike costs', () => {
  const g = sim(OPEN, { x: 1, y: 1 }); g.s.hero.modStats = { swap: -0.25 };
  g.s.hero.suit = ['quickswap']; g.s.hero.fx.swapReady = true;
  expect(swapCombo(g.s, 0, { noise: () => {} })).toBe(0);
  g.s.hero.suit.push('swapstrike'); g.s.hero.fx.swapReady = true;
  expect(swapCombo(g.s, 0, { noise: () => {} })).toBe(0.25);
});
