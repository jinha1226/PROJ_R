import { expect, it, vi } from 'vitest';
import { freshMeta, settleRun, SHOP } from '../../../src/sim/grid/meta';
import { canCraft, fit } from '../../../src/sim/grid/mods';
import { workbenchModel } from '../../../src/sim/grid/workbench';
import { nextFloor, settleKills } from '../../../src/sim/grid/run';
import { strike } from '../../../src/sim/grid/combat';
import { hurt } from '../../../src/sim/grid/status';
import { fromSave, toSave } from '../../../src/sim/grid/save';
import { newRunState } from '../../../src/sim/grid/runSetup';
import { launchOptions, panelContents } from '../../../src/ui/grid/ship/panelContents';
import { arena, foe } from './perkKit';
import { sureHits } from './kit';
it.each([5, 10, 15])('guardian on floor %i drops its unique reward', floor => {
  const sim = arena(), s = sim.s; s.run.floor = floor;
  const f = foe(sim); f.kind = 'champion'; f.alive = false; f.hp = 0;
  settleKills(s, new Set([f.id]));
  if (floor === 15) { expect(s.floorItems.some(f => f.item.kind === 'core')).toBe(true); expect(s.floorItems.some(f => f.item.kind === 'stone')).toBe(false); }
  else expect(s.floorItems).toContainEqual({ pos: f.pos, item: { kind: 'stone', id: `guardian${floor}`, name: floor === 5 ? '동굴 수호자의 핵' : '묘지 수호자의 핵' } });
});
it('opens a portal for a carried unsocketed guardian stone and banks everything else safely', () => {
  const sim = arena(), s = sim.s; s.run.stones = ['guardian5', 'soulCell']; s.run.materials.scrap = 9; s.stonePrompt = 'guardian5';
  s.hero.status = { freeze: 2, burn: 0, poison: 0 };
  const events = sim.act({ kind: 'portal', stone: 'guardian5' });
  expect(s.outcome).toBe('returned'); expect(s.run.portal).toBe(5); expect(s.run.stones).toEqual(['soulCell']);
  expect(s.time).toBe(0); expect(s.stonePrompt).toBeUndefined(); expect(s.hero.status.freeze).toBe(2);
  expect(events).toContainEqual({ t: 0, type: 'portal', text: '5' });
  const m = settleRun(freshMeta(), s); expect(m.portals).toEqual([5]); expect(m.materials.scrap).toBe(9);
  expect(m.mods.unlocked).toEqual(['soulCell']); expect(m.suit).toBeUndefined(); expect(m.wins).toBe(0);
  expect(settleRun(m, s).portals).toEqual([5]);
});
it('rejects missing, ordinary, and socketed stones as portal fuel', () => {
  const sim = arena(), s = sim.s; s.run.stones = ['scatter', 'guardian5']; sim.act({ kind: 'socket', stone: 'guardian5' });
  expect(s.hero.perks).toContain('whirlHeart');
  for (const stone of ['missing', 'scatter', 'guardian5']) expect(sim.act({ kind: 'portal', stone })[0]?.type).toBe('blocked');
  expect(s.outcome).toBeUndefined(); expect(s.run.stones).toEqual(['scatter', 'guardian5']);
});
it('guardian10 grants undying once per floor across saves, for blows and direct damage', () => {
  const sim = arena(), s = sim.s; s.run.stones = ['guardian10']; sim.act({ kind: 'socket', stone: 'guardian10' });
  expect(s.hero.perks).toContain('undyingHeart'); const f = foe(sim);
  vi.spyOn(s.rng, 'chance').mockImplementation(p => p >= 0.5);
  strike(s, 0, f, s.hero, 1, [1000, 1000], 1, 'melee');
  expect(s.hero.alive).toBe(true); expect(s.hero.hp).toBe(Math.ceil(s.hero.maxHp * 0.3));
  expect(s.events).toContainEqual({ t: 0, type: 'buff', text: 'undying' });
  const saved = fromSave(toSave(s)); expect(saved.hero.sockets).toEqual({ heart: 'guardian10' });
  hurt(saved, 1, f.id, saved.hero, 1000); expect(saved.hero.alive).toBe(false);
  nextFloor(s); hurt(s, 2, 'burn', s.hero, 1000); expect(s.hero.alive).toBe(true);
  hurt(s, 3, 'burn', s.hero, 1000); expect(s.hero.alive).toBe(false);
});
it('whirlHeart strikes adjacent foes on every third time-costing action, ignoring free choices', () => {
  const sim = arena(), s = sim.s; sureHits(sim); s.hero.perks = ['whirlHeart'];
  const a = foe(sim), b = foe(sim, 5, 6), far = foe(sim, 8);
  sim.act({ kind: 'wait' }); sim.act({ kind: 'socket', stone: null }); sim.act({ kind: 'wait' }); expect(a.hp).toBe(100);
  const events = sim.act({ kind: 'wait' }); expect(a.hp).toBeLessThan(100); expect(b.hp).toBeLessThan(100); expect(far.hp).toBe(100);
  expect(events.filter(e => e.type === 'bump' && e.text === 'whirl')).toHaveLength(2);
});
it('banks guardian hearts for free fitting, never crafting or workbench listing', () => {
  const s = arena().s; s.outcome = 'returned'; s.run.stones = ['guardian5', 'guardian10'];
  const m = settleRun(freshMeta(), s); expect(m.mods.unlocked).toEqual(['whirlHeart', 'undyingHeart']);
  expect(fit(freshMeta(), 'heart', 'whirlHeart')).toBe(false);
  expect(fit(m, 'heart', 'undyingHeart')).toBe(true); expect(canCraft(m, 'undyingHeart')).toBe(false);
  expect(workbenchModel(m).options('heart')).toEqual([]);
  expect(newRunState(3, m, { gun: 'pistol', start: 1, startSuit: [] }).hero.perks).toContain('undyingHeart');
});
it('requires the matching portal and nav repair for deep starts in both sim and choices', () => {
  const m = freshMeta(), opts = { gun: 'pistol', start: 6, startSuit: [] } as const;
  const option = () => ({ ...opts, startSuit: [] });
  m.portals = [5]; expect(launchOptions(m, option()).start).toBe(1); expect(newRunState(3, m, option()).run.floor).toBe(1);
  m.repairs = ['nav']; expect(launchOptions(m, option()).start).toBe(6); expect(newRunState(3, m, option()).run.floor).toBe(6);
  expect(panelContents(m, 'nav', option()).choices.map(c => c.id)).toEqual(['1', '6']);
  m.portals = [10]; expect(launchOptions(m, option()).start).toBe(1);
  expect(newRunState(3, m, { ...option(), start: 11 }).run.floor).toBe(11);
  expect(SHOP.some(e => ['navCrypt', 'navRuins'].includes(e.id))).toBe(false);
});
