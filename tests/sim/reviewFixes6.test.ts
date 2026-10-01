import { describe, it, expect } from 'vitest';
import { newProfile, claimStarterKit, loadoutToStash, sell, stashToLoadout } from '../../src/sim/extract/profile';
import { WorldSim, idleInput } from '../../src/sim/world/worldSim';
import { heroUnit } from '../../src/sim/world/worldState';
import { addItem, bagSlots } from '../../src/sim/extract/loadout';
import { NavGrid } from '../../src/sim/world/nav';
import { Battle } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';
import type { Obstacle } from '../../src/sim/battle/types';
import { testRegion, hero, kit } from './support/worldKit';

const SEC = 20;
const run = (sim: WorldSim, n: number, extra: Partial<ReturnType<typeof idleInput>> = {}) => { for (let i = 0; i < n && !sim.w.outcome; i++) sim.step({ ...idleInput(), ...extra }); };

describe('final review fixes (Plan 6)', () => {
  it('the free starter kit sells for nothing (no gold loop)', () => {
    let p = newProfile(3);
    p = loadoutToStash(loadoutToStash(p, 'weapon', 0), 'chest', 0);
    const gold = p.gold;
    p = sell(sell(p, 0), 0);
    expect(p.gold).toBe(gold);
    expect(claimStarterKit(p).loadout.equipped.weapon).toBe('x_sword_shield_0');
  });

  it('nothing can be moved once the sortie has ended', () => {
    const sim = new WorldSim(testRegion([]), hero(), addItem(kit(), 'x_crown').loadout, 1);
    sim.w.outcome = 'downed';
    sim.toPouch(0);
    sim.unequip('weapon');
    sim.lootDrop('bag', 0);
    expect(sim.w.hero.loadout.pouch).toBeNull();
    expect(sim.w.hero.loadout.bag).toEqual([{ id: 'x_crown', n: 1 }]);
    expect(sim.w.hero.loadout.equipped.weapon).toBeTruthy();
  });

  it('a dash in the region cannot pass through a wall', () => {
    const wall: Obstacle = { pos: { x: 0, y: 0 }, radius: 0, kind: 'box', half: { x: 0.4, y: 5 } };
    const s = { ...setupFromPresets(1, 'solo', 'empty'), obstacles: [wall], mode: 'world' as const, bounds: { minX: -30, maxX: 30, minY: -20, maxY: 20 } };
    s.allies = s.allies.map((u) => ({ ...u, spawn: { x: -1, y: 0 } }));
    const b = new Battle(s);
    const u = b.state.units[0]!;
    u.forced = { vel: { x: 30, y: 0 }, ticksLeft: 4, kind: 'dash' };
    for (let i = 0; i < 6; i++) b.step();
    expect(u.pos.x).toBeLessThan(0);
  });

  it('a hub swap to a smaller bag sends the overflow to the stash', () => {
    let p = newProfile(3);
    p = { ...p, loadout: { ...p.loadout, equipped: { ...p.loadout.equipped, bag: 'x_bag_2' }, bag: Array.from({ length: 12 }, () => ({ id: 'x_spoon', n: 1 })) }, stash: [{ id: 'x_bag_0', n: 1 }] };
    p = stashToLoadout(p, 0);
    expect(p.loadout.bag.length).toBeLessThanOrEqual(bagSlots(p.loadout));
    const total = p.loadout.bag.reduce((a, s) => a + (s.id === 'x_spoon' ? s.n : 0), 0) + p.stash.reduce((a, s) => a + (s.id === 'x_spoon' ? s.n : 0), 0);
    expect(total).toBe(12);
  });

  it('drinking never cancels recall or extraction, and a second recall is refused', () => {
    const l = { ...kit(), equipped: { ...kit().equipped, belt: 'x_belt_2' }, quick: [{ id: 'x_recall', n: 2 }, { id: 'x_potion_s', n: 2 }, null] };
    const sim = new WorldSim(testRegion([]), hero(), l, 1);
    heroUnit(sim.w).hp = heroUnit(sim.w).maxHp / 2;
    run(sim, 1); // the hp drop registers as a hit before the scroll is read
    run(sim, 1, { quick: 0 });
    run(sim, SEC);
    run(sim, 1, { quick: 1 });
    run(sim, 1, { quick: 0 });
    expect(sim.w.hero.channel?.kind).toBe('recall');
    expect(sim.w.hero.loadout.quick[0]).toEqual({ id: 'x_recall', n: 1 });
    run(sim, SEC * 10);
    expect(sim.w.outcome).toBe('extracted');
  });

  it('equip finishes on the chosen item even if the bag shifts meanwhile', () => {
    let l = addItem(kit(), 'x_cup').loadout;
    l = addItem(l, 'x_head_2').loadout;
    const sim = new WorldSim(testRegion([]), hero(), l, 1);
    sim.equip(1);
    sim.lootDrop('bag', 0);
    run(sim, SEC * 3);
    expect(sim.w.hero.loadout.equipped.head).toBe('x_head_2');
  });

  it('chasers can path to a hero hugging a wall', () => {
    const wall: Obstacle = { pos: { x: 0, y: 0 }, radius: 0, kind: 'box', half: { x: 0.4, y: 10 } };
    const g = new NavGrid({ minX: -30, maxX: 30, minY: -20, maxY: 20 }, [wall]);
    expect(g.path({ x: -10, y: 0 }, { x: 0.85, y: 0 })).not.toBeNull();
  });
});
