import { expect, it } from 'vitest';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { freshMeta } from '../../../src/sim/grid/meta';
import { MODS } from '../../../src/sim/grid/mods';
import { pickUp } from '../../../src/sim/grid/weapons';
import { settleKills } from '../../../src/sim/grid/run';
import { fromSave, toSave } from '../../../src/sim/grid/save';
import { scatterLoot } from '../../../src/sim/grid/consumables';
import { arena, foe } from './perkKit';

it('picks up a stone and prompts; keep is free even while frozen', () => {
  const sim = arena(), s = sim.s;
  s.floorItems.push({ pos: { ...s.hero.pos }, item: { kind: 'stone', id: 'soulCell', name: '영혼 전지 마석' } });
  pickUp(s, 0); expect(s.run.stones).toEqual(['soulCell']); expect(s.stonePrompt).toBe('soulCell');
  expect(s.events).toContainEqual({ t: 0, type: 'stone', text: 'soulCell' });
  s.hero.status = { freeze: 2, burn: 0, poison: 0 }; s.hero.fx.taps = 2; s.hero.fx.momentum = true;
  sim.act({ kind: 'socket', stone: null });
  expect(s.stonePrompt).toBeUndefined(); expect(s.time).toBe(0); expect(s.hero.status.freeze).toBe(2);
  expect(s.hero.fx.taps).toBe(2); expect(s.hero.fx.momentum).toBe(true); expect(s.run.stones).toEqual(['soulCell']);
});
it('replaces fitted charge and HP stats without double-counting or removing upgrades', () => {
  const m = freshMeta(); m.mods.fitted = { mag: 'extMag', chest: 'plating' }; m.mods.unlocked = ['scatter'];
  const sim = GridSim.createRun(3, m, { gun: 'pistol', start: 1, startSuit: [] }), s = sim.s;
  expect(s.run.modsUnlocked).toEqual(['scatter']); expect(s.hero.baseMods).toEqual(m.mods.fitted);
  s.hero.maxCharge += 2; s.hero.charge = s.hero.maxCharge;
  s.run.stones.push('soulCell', 'reactive'); sim.act({ kind: 'socket', stone: 'soulCell' });
  expect(s.hero.maxCharge).toBe(12); expect(s.hero.charge).toBe(12); expect(s.hero.perks).toContain('soulCell');
  sim.act({ kind: 'socket', stone: 'reactive' }); expect(s.hero.maxHp).toBe(35); expect(s.hero.hp).toBe(35);
  expect(s.hero.modStats?.maxHp ?? 0).toBe(0); expect(m.mods.fitted).toEqual({ mag: 'extMag', chest: 'plating' });
  expect(fromSave(toSave(s)).hero).toEqual(s.hero);
});
it('breaks only one copy of a replaced stone and recomputes its perk', () => {
  const sim = arena(), s = sim.s; s.run.stones.push('scatter', 'scatter', 'pierceBarrel');
  sim.act({ kind: 'socket', stone: 'scatter' }); sim.act({ kind: 'socket', stone: 'pierceBarrel' });
  expect(s.run.stones).toEqual(['scatter', 'pierceBarrel']); expect(s.hero.sockets).toEqual({ barrel: 'pierceBarrel' });
  expect(s.hero.perks).toEqual(['pierceBarrel']); expect(s.events).toContainEqual({ t: 0, type: 'stoneBreak', text: 'scatter' });
  const before = toSave(s); sim.act({ kind: 'socket', stone: 'missing' });
  expect(s.run.stones).toEqual(JSON.parse(before).state.run.stones);
  expect(sim.act({ kind: 'socket', stone: 'pierceBarrel' })[0]?.type).toBe('blocked');
});
it('allows ordinary actions while a stone prompt waits', () => {
  const sim = arena(); sim.s.stonePrompt = 'scatter'; sim.act({ kind: 'wait' });
  expect(sim.s.time).toBe(1); expect(sim.s.stonePrompt).toBe('scatter');
});
it('drops a stone from the elite family pool for a deterministic seed', () => {
  let dropped = false;
  for (let seed = 0; seed < 100 && !dropped; seed++) {
    const sim = arena(seed), s = sim.s, f = foe(sim); f.elite = true; f.alive = false; f.hp = 0;
    settleKills(s, new Set([f.id]));
    const stone = s.floorItems.find(f => f.item.kind === 'stone')?.item;
    if (stone?.kind === 'stone') {
      expect(['arms', 'legs', 'chest']).toContain(MODS.find(m => m.id === stone.id)?.slot); dropped = true;
    }
  }
  expect(dropped).toBe(true);
});
it('tool-room rewards include a guaranteed stone beside materials', () => {
  const s = arena().s; const reward = { x: 10, y: 10 };
  s.map.toolSpots = [{ kind: 'seal', pos: { x: 9, y: 10 }, room: { x: 10, y: 9, w: 3, h: 3 }, reward, n: 3 }];
  const items = scatterLoot(s).filter(f => f.pos.x === 10 && f.pos.y === 10);
  expect(items.map(f => f.item.kind)).toEqual(['material', 'stone']);
});
it('loads and plays pre-stone saves with safe defaults', () => {
  const raw = JSON.parse(toSave(arena().s));
  delete raw.state.run.stones; delete raw.state.run.modsUnlocked; delete raw.state.hero.sockets; delete raw.state.hero.perks; delete raw.state.hero.baseMods;
  const s = fromSave(JSON.stringify(raw));
  expect(s.run.stones).toEqual([]); expect(s.run.modsUnlocked).toEqual([]); expect(s.hero.sockets).toEqual({}); expect(s.hero.perks).toEqual([]);
  expect(() => GridSim.fromState(s).act({ kind: 'wait' })).not.toThrow();
});
