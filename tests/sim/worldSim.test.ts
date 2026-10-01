import { describe, it, expect } from 'vitest';
import { WorldSim, idleInput, type HeroInput } from '../../src/sim/world/worldSim';
import { heroUnit, unit } from '../../src/sim/world/worldState';
import { addItem, emptyLoadout, type Loadout } from '../../src/sim/extract/loadout';
import { generateRegion } from '../../src/sim/extract/region';
import type { Obstacle } from '../../src/sim/battle/types';
import { testRegion, spawn, hero, kit } from './support/worldKit';

const run = (sim: WorldSim, n: number, input: Partial<HeroInput> = {}) => { for (let i = 0; i < n && !sim.w.outcome; i++) sim.step({ ...idleInput(), ...input }); };
const SEC = 20;

describe('world sim: hero control', () => {
  it('moves with the stick, slower when heavily loaded', () => {
    const light = new WorldSim(testRegion([]), hero(), kit(), 1);
    run(light, SEC, { move: { x: 1, y: 0 } });
    let heavy: Loadout = { ...kit(), equipped: { ...kit().equipped, bag: 'x_bag_0' } }; // carry 20
    for (const id of ['x_idol', 'x_grail', 'x_crown']) heavy = addItem(heavy, id).loadout; // ~95% of the limit
    const slow = new WorldSim(testRegion([]), hero(), heavy, 1);
    run(slow, SEC, { move: { x: 1, y: 0 } });
    expect(heroUnit(light.w).pos.x).toBeGreaterThan(2.5);
    expect(heroUnit(slow.w).pos.x).toBeLessThan(heroUnit(light.w).pos.x * 0.85);
  });

  it('attack aims at the enemy in front before a nearer one behind', () => {
    const sim = new WorldSim(testRegion([spawn('front', 1.2, 0, 'g1'), spawn('back', -1.0, 0, 'g2')]), hero(), kit(), 1);
    heroUnit(sim.w).facing = 0;
    run(sim, 2, { attack: true });
    expect(heroUnit(sim.w).action?.targetId).toBe('front');
  });

  it('hitting an unaware enemy alerts its group', () => {
    const sim = new WorldSim(testRegion([spawn('a', 1.2, 0), spawn('b', 6, 6)]), hero(), kit(), 1);
    unit(sim.w, 'a').facing = 0;
    heroUnit(sim.w).facing = 0;
    run(sim, SEC, { attack: true });
    expect(sim.w.groups.g1!.alerted).toBe(true);
  });
});

describe('world sim: interaction and loot', () => {
  const withChest = () => testRegion([], { containers: [{ id: 'c1', kind: 'crate', pos: { x: 1.5, y: 0 }, tier: 1, extra: ['x_vault_key'] }] });

  it('searching takes 1.5 s, opens the chest, and moving cancels it', () => {
    const sim = new WorldSim(withChest(), hero(), kit(), 1);
    run(sim, 1, { interact: true });
    expect(sim.w.hero.channel?.kind).toBe('search');
    run(sim, 10, { move: { x: 0, y: 1 } });
    expect(sim.w.hero.channel).toBeUndefined();
    heroUnit(sim.w).pos = { x: 0, y: 0 };
    run(sim, 1, { interact: true });
    run(sim, 31);
    expect(sim.w.containers.c1!.opened).toBe(true);
    const keyAt = sim.w.containers.c1!.items.findIndex((s) => s.id === 'x_vault_key');
    expect(sim.lootTake('c1', keyAt)).toBe(true);
    expect(sim.w.hero.loadout.bag.some((s) => s.id === 'x_vault_key')).toBe(true);
  });

  it('dropping leaves a pile that can be picked up again', () => {
    const l = addItem(kit(), 'x_crown').loadout;
    const sim = new WorldSim(testRegion([]), hero(), l, 1);
    sim.lootDrop('bag', 0);
    expect(sim.w.hero.loadout.bag.length).toBe(0);
    expect(sim.w.piles[0]!.items).toEqual([{ id: 'x_crown', n: 1 }]);
    expect(sim.lootTake(sim.w.piles[0]!.id, 0)).toBe(true);
    expect(sim.w.hero.loadout.bag).toEqual([{ id: 'x_crown', n: 1 }]);
  });

  it('a vault door opens with the key and becomes passable', () => {
    const door: Obstacle = { pos: { x: 3, y: 0 }, radius: 0, kind: 'box', half: { x: 0.4, y: 2 } };
    const region = testRegion([], { pois: [{ id: 'v', kind: 'vault', center: { x: 6, y: 0 }, radius: 5, risk: 2, door: { box: door, key: 'x_vault_key' } }] }, [door]);
    const sim = new WorldSim(region, hero(), addItem(kit(), 'x_vault_key').loadout, 1);
    heroUnit(sim.w).pos = { x: 1.5, y: 0 };
    run(sim, 1, { interact: true });
    expect(sim.w.doorsOpen).toEqual(['v']);
    expect(sim.w.hero.loadout.bag.some((s) => s.id === 'x_vault_key')).toBe(false);
    run(sim, SEC * 3, { move: { x: 1, y: 0 } });
    expect(heroUnit(sim.w).pos.x).toBeGreaterThan(4);
  });
});

describe('world sim: extraction, clock, hazards, death', () => {
  it('standing 8 s in an open extraction point extracts; damage restarts the count', () => {
    const sim = new WorldSim(testRegion([], { start: { x: 50, y: 0 } }), hero(), kit(), 1);
    run(sim, SEC * 4);
    expect(sim.w.hero.channel?.kind).toBe('extract');
    heroUnit(sim.w).hp -= 10;
    run(sim, 1);
    expect(sim.w.hero.channel!.ticks).toBeLessThanOrEqual(1);
    run(sim, SEC * 8 + 2);
    expect(sim.w.outcome).toBe('extracted');
  });

  it('a closed extraction point no longer works', () => {
    const region = testRegion([], { start: { x: 50, y: 0 }, extracts: [{ id: 'x0', pos: { x: 50, y: 0 }, radius: 2.5, closesAt: 1 }] });
    const sim = new WorldSim(region, hero(), kit(), 1);
    run(sim, SEC * 10);
    expect(sim.w.closed).toEqual(['x0']);
    expect(sim.w.outcome).toBeNull();
  });

  it('the recall scroll extracts from anywhere after 10 s', () => {
    const l = { ...kit(), quick: [{ id: 'x_recall', n: 1 }] };
    const sim = new WorldSim(testRegion([]), hero(), l, 1);
    run(sim, 1, { quick: 0 });
    expect(sim.w.hero.loadout.quick[0]).toBeNull();
    run(sim, SEC * 10 + 2);
    expect(sim.w.outcome).toBe('extracted');
  });

  it('clock events fire on schedule', () => {
    const sim = new WorldSim(generateRegion(3), hero(), kit(), 3);
    const before = sim.w.b.units.length;
    heroUnit(sim.w).pos = { ...sim.w.region.start };
    for (let i = 0; i < SEC * 61 * 10 + 5; i++) { sim.w.b.tick = i; sim.clockOnly(); }
    const types = sim.w.events.map((e) => e.type);
    expect(types).toContain('dusk');
    expect(types).toContain('closing');
    expect(types).toContain('night');
    expect(types).toContain('storm');
    expect(sim.w.closed.length).toBe(1);
    expect(sim.w.b.units.length).toBeGreaterThan(before);
    expect(sim.w.b.units.length).toBeLessThanOrEqual(120);
    expect(Object.values(sim.w.groups).some((g) => g.hunter)).toBe(true);
  });

  it('poison hurts unless an antidote was taken', () => {
    const region = testRegion([], { hazards: [{ kind: 'poison', center: { x: 0, y: 0 }, radius: 5 }] });
    const sim = new WorldSim(region, hero(), kit(), 1);
    const hp0 = heroUnit(sim.w).hp;
    run(sim, SEC * 3);
    expect(heroUnit(sim.w).hp).toBeLessThan(hp0);
    const safe = new WorldSim(region, hero(), { ...kit(), quick: [{ id: 'x_antidote', n: 1 }] }, 1);
    run(safe, 1, { quick: 0 });
    const hp1 = heroUnit(safe.w).hp;
    run(safe, SEC * 3);
    expect(heroUnit(safe.w).hp).toBe(hp1);
  });

  it('going down ends the sortie once', () => {
    const sim = new WorldSim(testRegion([]), hero(), emptyLoadout(), 1);
    heroUnit(sim.w).hp = 1;
    heroUnit(sim.w).downed = true;
    run(sim, 3);
    expect(sim.w.outcome).toBe('downed');
    expect(sim.w.events.filter((e) => e.type === 'downed_end').length).toBe(1);
  });
});

describe('world sim: determinism and cost', () => {
  const script = (i: number): HeroInput => ({ ...idleInput(), move: { x: Math.cos(i / 40), y: Math.sin(i / 55) }, attack: i % 7 === 0, skill1: i % 90 === 0 });
  it('the same inputs replay to the same sortie', () => {
    const play = () => { const s = new WorldSim(generateRegion(5), hero(), kit(), 5); for (let i = 0; i < 1200 && !s.w.outcome; i++) s.step(script(i)); return JSON.stringify(s.snapshot(200)); };
    expect(play()).toEqual(play());
  });
  it('a minute on a full region runs headless in under 3 s', () => {
    const s = new WorldSim(generateRegion(9), hero(), kit(), 9);
    const t0 = performance.now();
    for (let i = 0; i < 1200 && !s.w.outcome; i++) s.step({ ...script(i), auto: true });
    expect(performance.now() - t0).toBeLessThan(3000);
  });
});
