import { expect, it } from 'vitest';
import { freshMeta, settleRun } from '../../../src/sim/grid/meta';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { pickUp } from '../../../src/sim/grid/weapons';
import { arena } from './perkKit';

it.each(['won', 'returned'] as const)('%s banks and deduplicates regular stones, keeping full materials', outcome => {
  const s = arena().s, m = freshMeta(); s.outcome = outcome;
  s.run.stones = ['scatter', 'soulCell', 'scatter', 'longBarrel', 'unknown']; s.run.materials.scrap = 7;
  const out = settleRun(m, s);
  expect(out.mods.unlocked).toEqual(['scatter', 'soulCell']); expect(out.materials.scrap).toBe(7);
  expect(out.wins).toBe(outcome === 'won' ? 1 : 0); expect(out.coreSecured).toBe(outcome === 'won');
  expect(out.suit).toBeUndefined(); expect(m.mods.unlocked).toEqual([]);
});
it('leaves stone-only suits, recovers their stones without socketing, and banks them on return', () => {
  const s = arena().s; s.outcome = 'dead'; s.run.stones = ['scatter'];
  const m = settleRun(freshMeta(), s); expect(m.suit?.stones).toEqual(['scatter']); expect(m.mods.unlocked).toEqual([]);
  const next = GridSim.createRun(3, m, { gun: 'pistol', start: 1, startSuit: [] }).s;
  const suit = next.floorItems.find(f => f.item.kind === 'suit')!; expect(suit).toBeDefined();
  next.hero.pos = suit.pos; pickUp(next, 0); expect(next.run.stones).toEqual(['scatter']); expect(next.hero.sockets).toEqual({});
  next.outcome = 'returned'; const banked = settleRun(m, next);
  expect(banked.mods.unlocked).toEqual(['scatter']); expect(banked.suit).toBeUndefined();
  next.outcome = 'dead'; expect(settleRun(m, next).suit?.stones).toEqual(['scatter']);
});
it('a second death loses unrecovered older stones even when empty handed', () => {
  const m = freshMeta(); m.suit = { floor: 3, ids: ['dash'], stones: ['scatter'], killer: { kind: 'mage' } };
  const s = arena().s; s.outcome = 'dead';
  expect(settleRun(m, s).suit?.stones ?? []).toEqual([]);
  s.run.stones = ['soulCell']; expect(settleRun(m, s).suit?.stones).toEqual(['soulCell']);
  expect(m.suit.stones).toEqual(['scatter']);
});
