import { expect, it, vi } from 'vitest';
import { freshMeta, settleRun } from '../../../src/sim/grid/meta';
import { dropChance, zoneMaterial, emptyMaterials } from '../../../src/sim/grid/materials';
import { newRunState } from '../../../src/sim/grid/runSetup';
import { settleKills } from '../../../src/sim/grid/run';
import { pickUp } from '../../../src/sim/grid/weapons';
import { scatterLoot } from '../../../src/sim/grid/consumables';
import { fromSave, toSave } from '../../../src/sim/grid/save';
const run = () => newRunState(3, freshMeta(), { gun: 'pistol', start: 1, startSuit: [] });
it('maps zones and caps catch-up at one', () => {
  expect([1, 5, 6, 10, 11, 15].map(zoneMaterial)).toEqual(['scrap', 'scrap', 'soul', 'soul', 'relic', 'relic']);
  const m = freshMeta(); expect(dropChance(m, 'scrap')).toBe(0.375);
  m.materials.scrap = 5; expect(dropChance(m, 'scrap')).toBe(0.25);
  expect(dropChance(freshMeta(), 'scrap', 0.9)).toBe(1);
});
it.each([false, true])('ordinary foe drop uses captured stock and RNG: %s', drops => {
  const s = run(), f = s.foes[0]!; s.floorItems = []; f.elite = false; f.alive = false;
  const chance = vi.spyOn(s.rng, 'chance').mockReturnValue(drops);
  settleKills(s, new Set([f.id])); expect(chance).toHaveBeenCalledWith(0.375);
  expect(s.floorItems.filter(f => f.item.kind === 'material')).toHaveLength(Number(drops));
});
it('picks up materials and scatters two zone stacks', () => {
  const s = run();
  expect(scatterLoot(s).filter(f => f.item.kind === 'material' && f.item.n === 1)).toHaveLength(2);
  s.floorItems = [{ pos: s.hero.pos, item: { kind: 'material', mat: 'soul', n: 3 } }];
  pickUp(s, 0); expect(s.run.materials.soul).toBe(3); expect(s.floorItems).toEqual([]);
});
it.each(['dead', 'won', undefined] as const)('settles %s materials and retains losses even without engravings', outcome => {
  const s = run(), m = freshMeta(); s.hero.suit = []; s.outcome = outcome;
  s.run.materials = { scrap: 5, soul: 2, relic: 1, remains: 3 };
  const out = settleRun(m, s);
  expect(out.materials).toEqual(outcome === 'dead' ? { scrap: 2, soul: 1, relic: 0, remains: 1 } : s.run.materials);
  expect(m.materials).toEqual(emptyMaterials());
  if (outcome === 'dead') {
    expect(out.suit?.materials).toEqual({ scrap: 3, soul: 1, relic: 1, remains: 2 });
    const recovery = newRunState(4, out, { gun: 'pistol', start: 1, startSuit: [] });
    recovery.run.recovered = []; recovery.outcome = 'dead'; recovery.hero.suit = [];
    expect(settleRun(out, recovery).materials).toEqual(s.run.materials);
  }
});
it('copies stock, defaults legacy runs and removes legacy echoes', () => {
  const m = freshMeta(); m.materials.scrap = 8;
  const s = newRunState(3, m, { gun: 'pistol', start: 1, startSuit: [] });
  m.materials.scrap = 0; expect(s.run.stock.scrap).toBe(8);
  const old = JSON.parse(toSave(s)); delete old.state.run.materials; delete old.state.run.stock; delete old.state.run.tools;
  old.state.floorItems.push({ pos: s.hero.pos, item: { kind: 'echo', family: 'melee' } });
  const loaded = fromSave(JSON.stringify(old));
  expect(loaded.run.materials).toEqual(emptyMaterials()); expect(loaded.run.tools).toEqual([]);
  expect(loaded.floorItems.some(f => (f.item.kind as string) === 'echo')).toBe(false);
});
it('chests add 2–3 zone materials exactly once', async () => {
  const { sim, OPEN } = await import('./kit');
  for (const n of [2, 3]) {
    const g = sim(OPEN, { x: 1, y: 1 }); g.s.run.floor = 11;
    g.s.chests = [{ pos: { x: 2, y: 1 }, opened: false }];
    vi.spyOn(g.s.rng, 'int').mockReturnValue(n);
    g.act({ kind: 'move', dir: { x: 1, y: 0 } }); expect(g.s.run.materials.relic).toBe(n);
    g.act({ kind: 'move', dir: { x: 1, y: 0 } }); expect(g.s.run.materials.relic).toBe(n);
  }
});
it('recovers material-only suits through pickup and survives a save round trip', () => {
  const s = run(); s.hero.suit = []; s.outcome = 'dead'; s.run.materials.scrap = 5;
  const m = settleRun(freshMeta(), s);
  const r = fromSave(toSave(newRunState(4, m, { gun: 'pistol', start: 1, startSuit: [] })));
  const suit = r.floorItems.find(f => f.item.kind === 'suit')!;
  expect(suit).toBeDefined(); r.hero.pos = { ...suit.pos }; pickUp(r, 0);
  expect(r.run.recovered).toEqual([]); r.run.materials.scrap = 3; r.outcome = 'dead';
  const result = settleRun(m, r);
  expect(result.materials.scrap).toBe(6); expect(result.suit?.materials?.scrap).toBe(2);
});
